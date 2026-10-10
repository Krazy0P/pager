"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/ensure-profile";
import type {
  ConversationPreview,
  Message,
  Profile,
  Reaction,
} from "@/lib/chat-types";
import { conversationTitle } from "@/lib/format";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { ProfileSheet } from "@/components/chat/profile-sheet";
import { UserInfoSheet } from "@/components/chat/user-info-sheet";
import { GroupInfoSheet } from "@/components/chat/group-info-sheet";
import { ChatErrorState, ChatLoadingState, ChatSetupState } from "@/components/chat/chat-setup-state";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatThread } from "@/components/chat/chat-thread";
import { DeleteConfirmDialog } from "@/components/chat/delete-confirm-dialog";
import {
  PAGER_AI_BOT_ID,
  PAGER_AI_PROFILE,
  containsAiMention,
  isAiDirectChat,
} from "@/lib/ai-bot";

type SetupState = "loading" | "ready" | "missing-schema" | "error";

function getErrorMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    if ("error_description" in err && typeof (err as { error_description: unknown }).error_description === "string") {
      return (err as { error_description: string }).error_description;
    }
  }
  return String(err);
}

function isMissingSchemaError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase();
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("not find the table") ||
    msg.includes("not find the function") ||
    msg.includes("relation") ||
    code.startsWith("PGRST2") ||
    code === "42P01" ||
    code === "42883"
  );
}

export function ChatApp() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [setup, setSetup] = useState<SetupState>("loading");
  const [bootError, setBootError] = useState<string>("");
  const [me, setMe] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<string[]>([]);
  /** Active conversation: member id -> when they last read it (epoch ms) */
  const [readAt, setReadAt] = useState<Record<string, number>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileList, setMobileList] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userInfoOpen, setUserInfoOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // ── Selection / bulk-delete state ──────────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Message IDs the current user has hidden via "Delete for me" */
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());
  // ──────────────────────────────────────────────────────────────────────────
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingAt = useRef(0);
  const typingTimers = useRef(new Map<string, number>());
  const threadChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement>>({});
  const optimisticMessageIds = useRef(new Set<string>());

  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_my_conversations");
    if (error) {
      if (isMissingSchemaError(error)) {
        setSetup("missing-schema");
      }
      throw error;
    }
    const convs = (data ?? []) as ConversationPreview[];
    setConversations(convs);
    setSetup("ready");
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (!user || userError) {
        await supabase.auth.signOut().catch(() => {});
        router.replace("/auth/login");
        return;
      }

      try {
        const profile = await ensureProfile(supabase, user);
        if (cancelled) return;
        setMe(profile);

        const { data: allPeople, error: peopleError } = await supabase
          .from("profiles")
          .select("*")
          .neq("id", user.id)
          .order("display_name");
        if (peopleError) throw peopleError;
        if (!cancelled) {
          const list = (allPeople ?? []) as Profile[];
          const hasAi = list.some((p) => p.id === PAGER_AI_BOT_ID);
          setPeople(hasAi ? list : [PAGER_AI_PROFILE, ...list]);
        }

        await loadConversations();
      } catch (error) {
        if (cancelled) return;
        if (isMissingSchemaError(error)) {
          setSetup("missing-schema");
        } else {
          const msg = getErrorMessage(error) || "Could not load Pager";
          setBootError(msg);
          setSetup("error");
          toast.error(msg);
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadConversations, router, supabase]);

  useEffect(() => {
    if (!me) return;

    const presence = supabase.channel("pager-online", {
      config: { presence: { key: me.id } },
    });

    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({
            user_id: me.id,
            at: new Date().toISOString(),
          });
        }
      });

    const inbox = supabase
      .channel("pager-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          void loadConversations();
          // Track unread counts for non-active conversations
          const msg = payload.new as Message;
          if (
            payload.eventType === "INSERT" &&
            msg.sender_id !== me.id &&
            msg.conversation_id !== activeId
          ) {
            setUnreadCounts((prev) => ({
              ...prev,
              [msg.conversation_id]: (prev[msg.conversation_id] ?? 0) + 1,
            }));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(presence);
      void supabase.removeChannel(inbox);
    };
  }, [activeId, loadConversations, me, supabase]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setReactions([]);
      setHiddenMessageIds(new Set());
      setReadAt({});
      return;
    }

    // Exit select mode when switching conversations
    setIsSelectMode(false);
    setSelectedIds(new Set());

    // Clear unread for the conversation we just opened
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[activeId];
      return next;
    });

    let cancelled = false;
    const typingTimersMap = typingTimers.current;
    // created_at (server time) of the newest message this client has loaded
    let latestSeenAt: string | null = null;

    const channel = supabase.channel(`pager-thread-${activeId}`);
    threadChannel.current = channel;

    // Only count the chat as read while it is actually on screen
    const markRead = async () => {
      if (document.visibilityState !== "visible") return;
      await supabase.rpc("mark_conversation_read", { conv: activeId });
      // Tell anyone in the chat right away, so receipts update live even when
      // conversation_members isn't published for realtime
      if (me?.id && latestSeenAt) {
        void channel.send({
          type: "broadcast",
          event: "read",
          payload: { userId: me?.id, upTo: latestSeenAt },
        });
      }
    };

    const recordRead = (userId: string, at: number) => {
      if (!userId || Number.isNaN(at)) return;
      setReadAt((current) => ({
        ...current,
        [userId]: Math.max(current[userId] ?? 0, at),
      }));
    };

    const stopTyping = (userId: string) => {
      window.clearTimeout(typingTimersMap.get(userId));
      typingTimersMap.delete(userId);
      setTyping((current) => current.filter((id) => id !== userId));
    };

    const loadThread = async () => {
      const [
        { data: rows },
        { data: reactionRows },
        { data: hiddenRows },
        { data: memberRows },
      ] = await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", activeId)
            .order("created_at", { ascending: true }),
          supabase
            .from("message_reactions")
            .select("message_id, user_id, emoji"),
          supabase
            .from("user_deleted_messages")
            .select("message_id")
            .eq("user_id", me?.id ?? ""),
          supabase
            .from("conversation_members")
            .select("user_id, last_read_at")
            .eq("conversation_id", activeId),
        ]);

      if (cancelled) return;
      latestSeenAt = rows?.length ? rows[rows.length - 1].created_at : null;
      setMessages((rows ?? []) as Message[]);
      setReactions((reactionRows ?? []) as Reaction[]);
      setHiddenMessageIds(
        new Set((hiddenRows ?? []).map((r: { message_id: string }) => r.message_id)),
      );
      setReadAt(
        Object.fromEntries(
          (memberRows ?? []).map((r: { user_id: string; last_read_at: string }) => [
            r.user_id,
            Date.parse(r.last_read_at),
          ]),
        ),
      );
      await markRead();
      void loadConversations();
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void markRead().then(() => loadConversations());
    };
    document.addEventListener("visibilitychange", onVisible);

    void loadThread();

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const next = payload.new as Message;
          if (payload.eventType === "INSERT") {
            if (!latestSeenAt || Date.parse(next.created_at) > Date.parse(latestSeenAt)) {
              latestSeenAt = next.created_at;
            }
            setMessages((current) => {
              if (current.some((item) => item.id === next.id)) return current;

              // Check if this incoming message matches a streaming placeholder or optimistic message
              const streamOrOptimisticIndex = current.findIndex(
                (item) =>
                  item.id === next.id ||
                  (item.id.startsWith("ai-stream-") &&
                    item.sender_id === next.sender_id &&
                    item.conversation_id === next.conversation_id) ||
                  (optimisticMessageIds.current.has(item.id) &&
                    item.sender_id === next.sender_id &&
                    item.conversation_id === next.conversation_id &&
                    item.content === next.content &&
                    item.reply_to_id === next.reply_to_id),
              );

              if (streamOrOptimisticIndex !== -1) {
                optimisticMessageIds.current.delete(current[streamOrOptimisticIndex].id);
                return current.map((item, idx) =>
                  idx === streamOrOptimisticIndex ? next : item,
                );
              }

              return [...current, next];
            });
            // Mark read immediately for messages we receive
            if (next.sender_id !== me?.id) {
              stopTyping(next.sender_id);
              void markRead();
            }
          } else if (payload.eventType === "UPDATE") {
            setMessages((current) =>
              current.map((item) => (item.id === next.id ? next : item)),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => {
          void supabase
            .from("message_reactions")
            .select("message_id, user_id, emoji")
            .then(({ data }) => setReactions((data ?? []) as Reaction[]));
        },
      )
      .on("broadcast", { event: "read" }, ({ payload }) => {
        recordRead(payload.userId as string, Date.parse(payload.upTo as string));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const userId = payload.userId as string;
        if (!userId || userId === me?.id) return;
        if (payload.stopped) {
          stopTyping(userId);
          return;
        }
        setTyping((current) =>
          current.includes(userId) ? current : [...current, userId],
        );
        // One timer per person, restarted on every keystroke burst, so the
        // indicator stays steady while they keep typing
        window.clearTimeout(typingTimersMap.get(userId));
        typingTimersMap.set(
          userId,
          window.setTimeout(() => stopTyping(userId), 3000),
        );
      })
      .subscribe();

    // Live read receipts get their own channel: if conversation_members isn't
    // published for realtime yet, Supabase rejects every postgres_changes
    // binding on the channel, which would also stop new messages arriving.
    const readsChannel = supabase
      .channel(`pager-reads-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string };
          recordRead(row.user_id, Date.parse(row.last_read_at));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      threadChannel.current = null;
      void supabase.removeChannel(readsChannel);
      document.removeEventListener("visibilitychange", onVisible);
      typingTimersMap.forEach((timer) => window.clearTimeout(timer));
      typingTimersMap.clear();
      setTyping((current) => current.filter((id) => id === PAGER_AI_BOT_ID));
      void supabase.removeChannel(channel);
    };
  }, [activeId, loadConversations, me?.id, supabase]);

  // Hydrate media URLs for messages with file_path
  useEffect(() => {
    const missing = messages.filter(
      (message) => message.file_path && !mediaUrls[message.file_path],
    );
    if (missing.length === 0) return;

    const hydrate = async () => {
      const next: Record<string, string> = {};
      for (const message of missing) {
        const path = message.file_path;
        if (!path) continue;
        const { data } = await supabase.storage
          .from("chat-media")
          .createSignedUrl(path, 60 * 60);
        if (data?.signedUrl) next[path] = data.signedUrl;
      }
      if (Object.keys(next).length) {
        setMediaUrls((current) => ({ ...current, ...next }));
      }
    };

    void hydrate();
  }, [mediaUrls, messages, supabase]);

  // Auto-scroll to bottom on new messages or streaming tokens
  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeId, lastMessageContent, typing.length]);

  const active = conversations.find((item) => item.id === activeId) ?? null;
  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    map.set(PAGER_AI_BOT_ID, PAGER_AI_PROFILE);
    if (me) map.set(me.id, me);
    for (const person of people) map.set(person.id, person);
    for (const conversation of conversations) {
      for (const member of conversation.members ?? []) {
        const existing = map.get(member.id);
        map.set(member.id, existing ? { ...existing, ...member } : member);
      }
    }
    return map;
  }, [conversations, me, people]);

  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  const filteredConversations = conversations.filter((conversation) => {
    if (!me) return false;
    const title = conversationTitle(
      conversation.type,
      conversation.name,
      conversation.members,
      me.id,
    ).toLowerCase();
    return title.includes(search.toLowerCase());
  });

  const visibleMessages = messages.filter((message) => {
    // Filter out messages the user has hidden via "Delete for me"
    if (hiddenMessageIds.has(message.id)) return false;
    if (!messageQuery.trim()) return true;
    return (message.content ?? "")
      .toLowerCase()
      .includes(messageQuery.trim().toLowerCase());
  });

  const [isAiBusy, setIsAiBusy] = useState(false);

  const startDm = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_or_create_dm", {
        other_user: userId,
      });
      if (error) throw error;
      await loadConversations();
      setActiveId(data as string);
      setMobileList(false);
    } catch (error) {
      if (userId === PAGER_AI_BOT_ID) {
        toast.info(
          "Run the SQL script from supabase/schema.sql in your Supabase SQL editor to create the Pager AI bot user in your database!",
          { duration: 6000 },
        );
      } else {
        throw error;
      }
    }
  };

  const createGroup = async (name: string, memberIds: string[]) => {
    const { data, error } = await supabase.rpc("create_group_chat", {
      p_name: name,
      p_member_ids: memberIds,
    });
    if (error) throw error;
    await loadConversations();
    setActiveId(data as string);
    setMobileList(false);
  };

  const sendText = async (content: string, replyToId?: string) => {
    if (!me || !activeId) return;
    emitTypingStopped();
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: activeId,
      sender_id: me.id,
      content,
      type: "text",
      file_path: null,
      file_name: null,
      file_type: null,
      file_size: null,
      reply_to_id: replyToId ?? null,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    };
    optimisticMessageIds.current.add(optimisticId);
    setMessages((current) => [...current, optimisticMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
      conversation_id: activeId,
      sender_id: me.id,
      content,
      type: "text",
      ...(replyToId ? { reply_to_id: replyToId } : {}),
      })
      .select("*")
      .single();
    if (error) {
      optimisticMessageIds.current.delete(optimisticId);
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      throw error;
    }
    if (data) {
      optimisticMessageIds.current.delete(optimisticId);
      setMessages((current) =>
        current.map((message) => (message.id === optimisticId ? (data as Message) : message)),
      );
    }

    // Pager AI answers everything in its own DM; elsewhere only when called (@ai, @pager, /ai)
    const activeConv = conversations.find((item) => item.id === activeId);
    if (isAiDirectChat(activeConv) || containsAiMention(content)) {
      void triggerAiResponse(activeId, content, replyToId);
    }
  };

  const streamAiChat = async ({
    convId,
    userPrompt,
    replyId,
    mode,
  }: {
    convId: string;
    userPrompt?: string;
    replyId?: string;
    mode: "chat" | "summarize";
  }) => {
    setIsAiBusy(true);
    setTyping((current) =>
      current.includes(PAGER_AI_BOT_ID) ? current : [...current, PAGER_AI_BOT_ID],
    );

    // Create optimistic streaming message bubble immediately
    const streamMsgId = `ai-stream-${Date.now()}`;
    const streamingPlaceholder: Message = {
      id: streamMsgId,
      conversation_id: convId,
      sender_id: PAGER_AI_BOT_ID,
      content: "",
      type: "text",
      file_path: null,
      file_name: null,
      file_type: null,
      file_size: null,
      reply_to_id: replyId ?? null,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    };

    optimisticMessageIds.current.add(streamMsgId);
    setMessages((current) => [...current, streamingPlaceholder]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          prompt: userPrompt,
          replyToId: replyId,
          mode,
          stream: true,
        }),
      });

      if (!res.ok) {
        setMessages((current) => current.filter((m) => m.id !== streamMsgId));
        optimisticMessageIds.current.delete(streamMsgId);
        const result = await res.json().catch(() => ({}));
        if (result.needsKey) {
          toast.info("Add GEMINI_API_KEY to .env.local to enable Gemini responses!");
        } else {
          toast.error(result.error || "AI could not respond");
        }
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";
        let finalMessageId: string | null = null;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payloadStr = trimmed.replace(/^data:\s*/, "");
            try {
              const data = JSON.parse(payloadStr);
              if (data.error) {
                toast.error(data.error);
              }
              if (data.text) {
                accumulatedText += data.text;
                const currentText = accumulatedText;
                setMessages((current) =>
                  current.map((m) =>
                    m.id === streamMsgId ? { ...m, content: currentText } : m,
                  ),
                );
              }
              if (data.done) {
                if (data.messageId) {
                  finalMessageId = data.messageId;
                }
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }

        if (finalMessageId) {
          setMessages((current) =>
            current.map((m) =>
              m.id === streamMsgId ? { ...m, id: finalMessageId! } : m,
            ),
          );
        }
        if (mode === "summarize") {
          toast.success("AI Summary generated!");
        }
      } else {
        // Fallback for non-streaming response
        const result = await res.json();
        if (result.content) {
          setMessages((current) =>
            current.map((m) =>
              m.id === streamMsgId
                ? { ...m, content: result.content, id: result.messageId || m.id }
                : m,
            ),
          );
        }
      }
    } catch (err) {
      console.error("AI streaming failed:", err);
      setMessages((current) => current.filter((m) => m.id !== streamMsgId));
      optimisticMessageIds.current.delete(streamMsgId);
    } finally {
      setIsAiBusy(false);
      setTyping((current) => current.filter((id) => id !== PAGER_AI_BOT_ID));
    }
  };

  const triggerAiResponse = (
    convId: string,
    userPrompt: string,
    replyId?: string,
  ) => {
    return streamAiChat({
      convId,
      userPrompt,
      replyId,
      mode: "chat",
    });
  };

  const handleSummarize = () => {
    if (!activeId || isAiBusy) return;
    return streamAiChat({
      convId: activeId,
      mode: "summarize",
    });
  };

  const uploadFile = async (file: File) => {
    if (!activeId || !me) return;
    emitTypingStopped();
    const form = new FormData();
    form.set("file", file);
    form.set("conversationId", activeId);
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const payload = (await response.json()) as {
      error?: string;
      path?: string;
      kind?: "image" | "audio" | "file";
      mime?: string;
      name?: string;
      size?: number;
    };
    if (!response.ok || !payload.path || !payload.kind) {
      throw new Error(payload.error ?? "Upload failed");
    }
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: me.id,
      type: payload.kind,
      file_path: payload.path,
      file_name: payload.name,
      file_type: payload.mime,
      file_size: payload.size,
      content: payload.kind === "image" ? "Photo" : payload.name,
    });
    if (error) throw error;
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!me) return;
    const existing = reactions.find(
      (reaction) =>
        reaction.message_id === messageId &&
        reaction.user_id === me.id &&
        reaction.emoji === emoji,
    );
    setReactions((current) =>
      existing
        ? current.filter((reaction) => reaction !== existing)
        : [...current, { message_id: messageId, user_id: me.id, emoji }],
    );
    const { error } = existing
      ? await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", me.id)
        .eq("emoji", emoji)
      : await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: me.id,
        emoji,
      });
    if (error) {
      setReactions((current) =>
        existing
          ? [...current, existing]
          : current.filter(
              (reaction) =>
                !(
                  reaction.message_id === messageId &&
                  reaction.user_id === me.id &&
                  reaction.emoji === emoji
                ),
            ),
      );
      toast.error(error.message);
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    const previous = messages.find((message) => message.id === messageId);
    if (!previous) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content: newContent, edited_at: new Date().toISOString() }
          : message,
      ),
    );
    const { error } = await supabase
      .from("messages")
      .update({ content: newContent, edited_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) {
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? previous : message)),
      );
      throw error;
    }
  };

  /** Single-message delete prompt (opens dialog with "Delete for everyone" and "Delete for me" options) */
  const promptDeleteMessage = (messageId: string) => {
    setSelectedIds(new Set([messageId]));
    setDeleteDialogOpen(true);
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (messageId: string) => {
    // Entering select mode on first selection
    if (!isSelectMode) setIsSelectMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const cancelSelect = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const openDeleteDialog = () => {
    if (selectedIds.size === 0) return;
    setDeleteDialogOpen(true);
  };

  /** Delete selected messages for everyone (sets deleted_at). Only valid when all are mine. */
  const handleDeleteForEveryone = async () => {
    if (!me) return;
    const ids = Array.from(selectedIds);
    const previous = messages.filter((message) => ids.includes(message.id));
    setMessages((current) =>
      current.map((message) =>
        ids.includes(message.id)
          ? { ...message, deleted_at: new Date().toISOString(), content: "" }
          : message,
      ),
    );
    cancelSelect();
    setDeleteDialogOpen(false);
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("messages")
        .update({ deleted_at: new Date().toISOString(), content: "" })
        .in("id", ids);
      if (error) throw error;
    } catch (err) {
      setMessages((current) =>
        current.map((message) => previous.find((item) => item.id === message.id) ?? message),
      );
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  /** Hide selected messages only for the current user (inserts into user_deleted_messages). */
  const handleDeleteForMe = async () => {
    if (!me) return;
    const ids = Array.from(selectedIds);
    setHiddenMessageIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    cancelSelect();
    setDeleteDialogOpen(false);
    setDeleting(true);
    try {
      const rows = ids.map((id) => ({ user_id: me.id, message_id: id }));
      const { error } = await supabase
        .from("user_deleted_messages")
        .insert(rows);
      if (error) throw error;
    } catch (err) {
      setHiddenMessageIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      const msg = err instanceof Error ? err.message : "Delete failed";
      if (typeof msg === "string" && (msg.includes("user_deleted_messages") || msg.includes("42P01"))) {
        toast.error("Please run the user_deleted_messages SQL migration in Supabase");
      } else {
        toast.error(msg);
      }
    } finally {
      setDeleting(false);
    }
  };

  /** True only when every selected message was sent by the current user */
  const canDeleteForEveryone = useMemo(() => {
    if (!me || selectedIds.size === 0) return false;
    return [...selectedIds].every((id) => {
      const msg = messagesById.get(id);
      return msg?.sender_id === me.id;
    });
  }, [me, messagesById, selectedIds]);

  const emitTyping = () => {
    if (!activeId || !me) return;
    const now = Date.now();
    if (now - typingAt.current < 700) return;
    typingAt.current = now;
    void threadChannel.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: me.id },
    });
  };

  /** Clears our typing indicator for others right away, e.g. once we send */
  const emitTypingStopped = () => {
    if (!me || !typingAt.current) return;
    typingAt.current = 0;
    void threadChannel.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: me.id, stopped: true },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-primary/10");
      setTimeout(() => el.classList.remove("bg-primary/10"), 1600);
    }
  };

  if (setup === "missing-schema") {
    return <ChatSetupState onSignOut={() => void signOut()} />;
  }

  if (setup === "error") {
    return (
      <ChatErrorState
        message={bootError}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (setup === "loading" || !me) {
    return <ChatLoadingState />;
  }

  const title = active
    ? conversationTitle(active.type, active.name, active.members, me.id)
    : "Select a chat";
  const peer = active?.members.find((member) => member.id !== me.id);
  const typingNames = typing
    .map((id) => profilesById.get(id)?.display_name)
    .filter(Boolean) as string[];
  // Pager AI's typing shows as its streaming bubble, so the thread skips it
  const typingPeople = typing
    .filter((id) => id !== PAGER_AI_BOT_ID)
    .map((id) => profilesById.get(id))
    .filter(Boolean) as Profile[];

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <ChatSidebar
        me={me}
        filteredConversations={filteredConversations}
        activeId={activeId}
        unreadCounts={unreadCounts}
        onlineIds={onlineIds}
        mobileList={mobileList}
        search={search}
        onSearchChange={setSearch}
        onSelect={(id) => {
          setActiveId(id);
          setMobileList(false);
        }}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenNewChat={() => setComposerOpen(true)}
        onSignOut={() => void signOut()}
      />

      <ChatThread
        active={active}
        me={me}
        title={title}
        peer={peer}
        onlineIds={onlineIds}
        typingNames={typingNames}
        typingPeople={typingPeople}
        readAt={readAt}
        mobileList={mobileList}
        visibleMessages={visibleMessages}
        messagesById={messagesById}
        profilesById={profilesById}
        reactions={reactions}
        mediaUrls={mediaUrls}
        messageQuery={messageQuery}
        replyTo={replyTo}
        bottomRef={bottomRef}
        messageRefs={messageRefs}
        isSelectMode={isSelectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onCancelSelect={cancelSelect}
        onDeleteSelected={openDeleteDialog}
        onBack={() => setMobileList(true)}
        onMessageQueryChange={setMessageQuery}
        onOpenGroupInfo={() => setGroupInfoOpen(true)}
        onOpenUserInfo={() => setUserInfoOpen(true)}
        onOpenNewChat={() => setComposerOpen(true)}
        onToggleReaction={(messageId, emoji) => void toggleReaction(messageId, emoji)}
        onEditMessage={editMessage}
        onDeleteMessage={promptDeleteMessage}
        onReply={setReplyTo}
        onScrollToMessage={scrollToMessage}
        onSend={sendText}
        onTyping={emitTyping}
        onUpload={uploadFile}
        onClearReply={() => setReplyTo(null)}
        people={people}
        onStartDm={startDm}
        onSummarize={handleSummarize}
        isAiBusy={isAiBusy}
      />

      {/* ── Dialogs / Sheets ── */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !isSelectMode) {
            setSelectedIds(new Set());
          }
        }}
        count={selectedIds.size}
        canDeleteForEveryone={canDeleteForEveryone}
        deleting={deleting}
        onDeleteForEveryone={() => void handleDeleteForEveryone()}
        onDeleteForMe={() => void handleDeleteForMe()}
      />

      <NewChatDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        people={people}
        onlineIds={onlineIds}
        onStartDm={startDm}
        onCreateGroup={createGroup}
      />

      <ProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={me}
        onUpdated={(updated) => setMe(updated)}
      />

      <UserInfoSheet
        open={userInfoOpen}
        onOpenChange={setUserInfoOpen}
        profile={peer}
      />

      {active && active.type === "group" && (
        <GroupInfoSheet
          open={groupInfoOpen}
          onOpenChange={setGroupInfoOpen}
          conversation={active}
          myId={me.id}
          onUpdated={(updated) => {
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === updated.id ? updated : conversation,
              ),
            );
          }}
          onLeft={() => {
            setConversations((current) =>
              current.filter((item) => item.id !== active.id),
            );
            setActiveId(null);
          }}
        />
      )}
    </div>
  );
}
