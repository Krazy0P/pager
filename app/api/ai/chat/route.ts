import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    PAGER_AI_BOT_ID,
    containsAiMention,
    isAiDirectChat,
} from "@/lib/ai-bot";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

// How much history the model sees. Flash-Lite's context window is far larger;
// these keep latency and cost reasonable while covering long chats.
const HISTORY_MESSAGE_LIMIT = 200;
const HISTORY_CHAR_BUDGET = 60_000;

const SUMMARIZE_COMMAND = /(?:^|\s)\/summari[sz]e\b/i;

const ATTACHMENT_LABELS: Record<string, string> = {
    image: "an image",
    audio: "a voice note",
    file: "a file",
};

type HistoryEntry = {
    senderId: string;
    sender: string;
    time: string;
    text: string;
    replyNote: string;
};

type ChatTurn = { role: "user" | "model"; parts: { text: string }[] };

/** Text the model sees for a message; attachments become a short placeholder. */
function describeMessage(m: {
    type: string;
    content: string | null;
    file_name: string | null;
}): string | null {
    const text = m.content?.trim() ?? "";
    if (m.type === "text") return text || null;
    const label = ATTACHMENT_LABELS[m.type] ?? "an attachment";
    const name = m.file_name ? `: ${m.file_name}` : "";
    return `[shared ${label}${name}]${text ? ` ${text}` : ""}`;
}

/** "2026-10-10T14:05:12.345+00:00" → "2026-10-10 14:05" (UTC) */
function formatTime(iso: string) {
    return iso.slice(0, 16).replace("T", " ");
}

/**
 * Maps chat history onto Gemini turns: Pager AI's own messages become model
 * turns, everyone else's become user turns prefixed with the sender's name.
 */
function buildChatTurns(
    history: HistoryEntry[],
    prompt: string | undefined,
    askerName: string,
): ChatTurn[] {
    const turns: ChatTurn[] = [];
    for (const entry of history) {
        const role = entry.senderId === PAGER_AI_BOT_ID ? "model" : "user";
        const text =
            role === "model"
                ? entry.text
                : `${entry.sender}: ${entry.text}${entry.replyNote}`;
        const last = turns[turns.length - 1];
        if (last?.role === role) last.parts[0].text += `\n${text}`;
        else turns.push({ role, parts: [{ text }] });
    }

    // Keep the conversation starting and ending on a user turn
    if (turns[0]?.role === "model") {
        turns.unshift({ role: "user", parts: [{ text: "(earlier conversation)" }] });
    }
    const latest = prompt?.trim();
    const last = turns[turns.length - 1];
    if (!last || last.role === "model") {
        turns.push({
            role: "user",
            parts: [
                {
                    text: latest
                        ? `${askerName}: ${latest}`
                        : "Please respond to the latest discussion.",
                },
            ],
        });
    } else if (latest && !last.parts[0].text.includes(latest)) {
        // The triggering message may not be visible to this query yet
        last.parts[0].text += `\n${askerName}: ${latest}`;
    }
    return turns;
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            conversationId,
            prompt,
            replyToId,
            mode = "chat",
            stream: enableStream = true,
        }: {
            conversationId?: string;
            prompt?: string;
            replyToId?: string;
            mode?: "chat" | "summarize";
            stream?: boolean;
        } = body;

        if (!conversationId) {
            return NextResponse.json(
                { error: "Missing conversationId" },
                { status: 400 },
            );
        }

        // Verify caller is a member of this conversation
        const { data: membership } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conversationId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json(
                { error: "You are not a member of this conversation" },
                { status: 403 },
            );
        }

        // Fetch conversation details, participants, and recent messages
        const [{ data: conversation }, { data: members }, { data: rawMessages }] =
            await Promise.all([
                supabase
                    .from("conversations")
                    .select("id, type, name")
                    .eq("id", conversationId)
                    .single(),
                supabase
                    .from("conversation_members")
                    .select("user_id, profiles(id, username, display_name)")
                    .eq("conversation_id", conversationId),
                // Newest first so the limit keeps the most recent messages; reversed below
                supabase
                    .from("messages")
                    .select(
                        "id, sender_id, content, type, file_name, reply_to_id, created_at, profiles(display_name, username)",
                    )
                    .eq("conversation_id", conversationId)
                    .is("deleted_at", null)
                    .order("created_at", { ascending: false })
                    .limit(HISTORY_MESSAGE_LIMIT),
            ]);

        // "/summarize" typed in the composer behaves like the summarize button
        const effectiveMode: "chat" | "summarize" =
            mode === "summarize" || SUMMARIZE_COMMAND.test(prompt ?? "")
                ? "summarize"
                : "chat";

        // Outside the user's own AI DM, Pager AI only answers when explicitly called
        if (effectiveMode === "chat" && conversation) {
            const isOwnAiChat = isAiDirectChat({
                type: conversation.type,
                members: (members ?? []).map((m) => ({ id: m.user_id as string })),
            });
            if (!isOwnAiChat && !containsAiMention(prompt)) {
                return NextResponse.json(
                    { error: "Mention @ai to ask Pager AI in this chat" },
                    { status: 400 },
                );
            }
        }

        // Build participant lookup
        const memberNames: Record<string, string> = {
            [PAGER_AI_BOT_ID]: "Pager AI",
        };

        if (members) {
            for (const m of members) {
                const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                if (p && typeof p === "object" && "id" in p) {
                    memberNames[p.id as string] =
                        (p.display_name as string) || (p.username as string) || "Teammate";
                }
            }
        }

        // Build chronological history, keeping the newest messages within the char budget
        const chronological = [...(rawMessages ?? [])].reverse();
        const byId = new Map(chronological.map((m) => [m.id, m]));
        const senderName = (m: (typeof chronological)[number]) => {
            if (memberNames[m.sender_id]) return memberNames[m.sender_id];
            // Senders who have since left the group are not in memberNames
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return p?.display_name || p?.username || "Former member";
        };

        const history: HistoryEntry[] = [];
        let budget = HISTORY_CHAR_BUDGET;
        for (let i = chronological.length - 1; i >= 0; i--) {
            const m = chronological[i];
            const body = describeMessage(m);
            if (!body) continue;

            let replyNote = "";
            const parent = m.reply_to_id ? byId.get(m.reply_to_id) : undefined;
            if (parent) {
                const quoted = (describeMessage(parent) ?? "").slice(0, 80);
                replyNote = ` (replying to ${senderName(parent)}: "${quoted}")`;
            } else if (m.reply_to_id) {
                replyNote = " (replying to an earlier message)";
            }

            const entry: HistoryEntry = {
                senderId: m.sender_id,
                sender: senderName(m),
                time: formatTime(m.created_at),
                text: body,
                replyNote,
            };
            budget -= body.length + replyNote.length + entry.sender.length + 20;
            if (budget < 0 && history.length > 0) break;
            history.unshift(entry);
        }

        const transcript = history
            .map((e) => `[${e.time}] ${e.sender}: ${e.text}${e.replyNote}`)
            .join("\n");

        const channelTitle =
            conversation?.name ||
            (conversation?.type === "direct" ? "Direct Message" : "Group Chat");

        // Check Gemini API key (supports case variations and aliases)
        let apiKey =
            process.env.GEMINI_API_KEY ||
            process.env.gemini_api_key ||
            process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
            process.env.GOOGLE_API_KEY ||
            process.env.GOOGLE_GENAI_API_KEY;

        if (!apiKey) {
            try {
                const fs = await import("fs");
                const path = await import("path");
                const envPath = path.resolve(process.cwd(), ".env.local");
                if (fs.existsSync(envPath)) {
                    const content = fs.readFileSync(envPath, "utf8");
                    const match = content.match(/GEMINI_API_KEY\s*=\s*(.+)/i);
                    if (match && match[1]) {
                        apiKey = match[1].trim().replace(/^["']|["']$/g, "");
                    }
                }
            } catch {
                // Ignore fs read errors
            }
        }

        if (!apiKey) {
            return NextResponse.json(
                {
                    error:
                        "GEMINI_API_KEY is not configured in .env.local. Get a free API key at https://aistudio.google.com/",
                    needsKey: true,
                },
                { status: 400 },
            );
        }

        // Initialize the official Google Gen AI SDK (@google/genai)
        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction =
            effectiveMode === "summarize"
                ? `You are Pager AI, an executive assistant in a team workspace.
Your task is to summarize the provided conversation (${channelTitle}).
The transcript is in chronological order; each line is "[time UTC] Sender: message".
Cover the whole transcript, giving more weight to the most recent discussion.
Structure your summary clearly:
- 📌 **Key Topics & Context**
- 💡 **Decisions Made**
- 🎯 **Action Items / Next Steps**
Keep it concise, high-signal, and easy for busy teammates to scan.`
                : `You are Pager AI, an intelligent, helpful, and concise teammate inside Pager — a modern real-time team chat platform.
Channel context: "${channelTitle}".
Participants: ${Object.values(memberNames).join(", ")}.

The conversation so far is provided as chat turns. Messages from people are prefixed with "Sender: "; your own earlier replies are the model turns.
Use the full history to understand context, who is speaking, and what was already said or decided.
- Answer the latest message that addressed you; refer back to earlier messages when relevant.
- When asked a question, provide direct, accurate, and insightful answers.
- Format responses cleanly using Markdown (bolding, bullet points, code blocks).
- Be conversational, friendly, and team-focused without unnecessary pleasantries.
- Do not prefix your reply with your own name.`;

        // Summaries get one transcript; chat gets real multi-turn history so the
        // model can tell its own earlier replies apart from what people said.
        const transcriptPrompt =
            effectiveMode === "summarize"
                ? `Summarize this conversation:\n\n${transcript || "(no messages yet)"}`
                : `Conversation so far:\n${transcript}\n\nRespond to the latest message that addressed you.`;
        const contents =
            effectiveMode === "summarize"
                ? [{ role: "user" as const, parts: [{ text: transcriptPrompt }] }]
                : buildChatTurns(history, prompt, memberNames[user.id] || "User");

        const primaryModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
        const candidateModels = Array.from(new Set([primaryModel, DEFAULT_MODEL]));

        console.log(
            `[AI Chat] mode=${effectiveMode} model=${primaryModel} conv=${conversationId} messages=${history.length}/${rawMessages?.length ?? 0} chars=${transcript.length}`,
        );

        if (enableStream) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    let fullReplyText = "";
                    let streamSuccess = false;
                    let lastError: unknown = null;

                    for (const modelName of candidateModels) {
                        try {
                            // Try generateContentStream first for high-performance direct text delta streaming
                            const responseStream = await ai.models.generateContentStream({
                                model: modelName,
                                contents,
                                config: {
                                    systemInstruction,
                                    temperature: 0.7,
                                },
                            });

                            for await (const chunk of responseStream) {
                                const text = chunk.text;
                                if (text) {
                                    fullReplyText += text;
                                    controller.enqueue(
                                        encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
                                    );
                                }
                            }

                            if (fullReplyText.trim().length > 0) {
                                streamSuccess = true;
                                break;
                            }
                        } catch (err) {
                            lastError = err;
                            console.warn(
                                `Gemini generateContentStream with ${modelName} failed, trying interactions fallback:`,
                                err,
                            );

                            // Fallback to interactions.create with stream: true
                            try {
                                const interactionStream = await ai.interactions.create({
                                    model: modelName,
                                    input: transcriptPrompt,
                                    system_instruction: systemInstruction,
                                    stream: true,
                                });

                                for await (const chunk of interactionStream) {
                                    const ev = chunk as { delta?: { text?: string }; output_text?: string };
                                    const text =
                                        ev?.delta?.text ||
                                        (typeof ev?.output_text === "string" ? ev.output_text : null);
                                    if (text) {
                                        fullReplyText += text;
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
                                        );
                                    }
                                }

                                if (fullReplyText.trim().length > 0) {
                                    streamSuccess = true;
                                    break;
                                }
                            } catch (innerErr) {
                                lastError = innerErr;
                                console.warn(
                                    `Gemini interactions.create stream with ${modelName} failed:`,
                                    innerErr,
                                );
                            }
                        }
                    }

                    if (!streamSuccess || !fullReplyText.trim()) {
                        const errMsg =
                            lastError instanceof Error ? lastError.message : "AI generation failed";
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`),
                        );
                        controller.close();
                        return;
                    }

                    // Persist the completed AI message to Supabase
                    let savedMessageId: string | null = null;
                    try {
                        const { data: rpcId, error: rpcError } = await supabase.rpc(
                            "send_ai_message",
                            {
                                p_conversation_id: conversationId,
                                p_content: fullReplyText.trim(),
                                p_reply_to_id: replyToId ?? null,
                            },
                        );

                        if (!rpcError && rpcId) {
                            savedMessageId = rpcId as string;
                        } else {
                            const { data: inserted } = await supabase
                                .from("messages")
                                .insert({
                                    conversation_id: conversationId,
                                    sender_id: PAGER_AI_BOT_ID,
                                    content: fullReplyText.trim(),
                                    type: "text",
                                    reply_to_id: replyToId ?? null,
                                })
                                .select("id")
                                .maybeSingle();

                            if (inserted?.id) {
                                savedMessageId = inserted.id;
                            }
                        }
                    } catch (dbErr) {
                        console.error("Failed to save streamed message to DB:", dbErr);
                    }

                    // Send final completion payload
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({
                                done: true,
                                messageId: savedMessageId,
                                content: fullReplyText.trim(),
                                needsMigration: !savedMessageId,
                            })}\n\n`,
                        ),
                    );
                    controller.close();
                },
            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream; charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                },
            });
        }

        // Non-streaming fallback
        let replyText = "";
        let lastError: unknown = null;

        for (const modelName of candidateModels) {
            try {
                const interaction = await ai.interactions.create({
                    model: modelName,
                    input: transcriptPrompt,
                    system_instruction: systemInstruction,
                });

                replyText = interaction.output_text?.trim() || "";
                if (replyText) break;
            } catch (err) {
                lastError = err;
                try {
                    const response = await ai.models.generateContent({
                        model: modelName,
                        contents,
                        config: {
                            systemInstruction,
                            temperature: 0.7,
                        },
                    });

                    replyText = response.text?.trim() || "";
                    if (replyText) break;
                } catch (innerErr) {
                    lastError = innerErr;
                }
            }
        }

        if (!replyText) {
            const errMsg =
                lastError instanceof Error ? lastError.message : "No response generated";
            throw new Error(`Gemini API error: ${errMsg}`);
        }

        let savedMessageId: string | null = null;
        const { data: rpcId, error: rpcError } = await supabase.rpc(
            "send_ai_message",
            {
                p_conversation_id: conversationId,
                p_content: replyText,
                p_reply_to_id: replyToId ?? null,
            },
        );

        if (!rpcError && rpcId) {
            savedMessageId = rpcId as string;
        } else {
            const { data: inserted } = await supabase
                .from("messages")
                .insert({
                    conversation_id: conversationId,
                    sender_id: PAGER_AI_BOT_ID,
                    content: replyText,
                    type: "text",
                    reply_to_id: replyToId ?? null,
                })
                .select("id")
                .maybeSingle();

            if (inserted?.id) {
                savedMessageId = inserted.id;
            }
        }

        return NextResponse.json({
            success: true,
            content: replyText,
            messageId: savedMessageId,
            needsMigration: !savedMessageId,
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Internal Server Error";
        console.error("AI chat error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
