"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Info,
  LogOut,
  MessageCircleDashed,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/ensure-profile";
import type {
  ConversationPreview,
  Message,
  Profile,
  Reaction,
} from "@/lib/chat-types";
import {
  conversationTitle,
  formatDay,
  formatListTime,
  previewText,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/chat/user-avatar";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { MessageItem } from "@/components/chat/message-item";
import { Composer } from "@/components/chat/composer";
import { ProfileSheet } from "@/components/chat/profile-sheet";
import { GroupInfoSheet } from "@/components/chat/group-info-sheet";
import { cn } from "@/lib/utils";

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
  const { theme, setTheme } = useTheme();
  const supabase = useMemo(() => createClient(), []);

  const [setup, setSetup] = useState<SetupState>("loading");
  const [bootError, setBootError] = useState<string>("");
  const [copiedSql, setCopiedSql] = useState(false);
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileList, setMobileList] = useState(true);
  const [otherReads, setOtherReads] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingAt = useRef(0);
  const threadChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement>>({});

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
      } = await supabase.auth.getUser();
      if (!user) {
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
        if (!cancelled) setPeople((allPeople ?? []) as Profile[]);

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
      return;
    }

    // Clear unread for the conversation we just opened
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[activeId];
      return next;
    });

    let cancelled = false;

    const loadThread = async () => {
      const [{ data: rows }, { data: reactionRows }, { data: memberRows }] =
        await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", activeId)
            .order("created_at", { ascending: true }),
          supabase
            .from("message_reactions")
            .select("message_id, user_id, emoji"),
          supabase
            .from("conversation_members")
            .select("user_id, last_read_at")
            .eq("conversation_id", activeId),
        ]);

      if (cancelled) return;
      setMessages((rows ?? []) as Message[]);
      setReactions((reactionRows ?? []) as Reaction[]);
      setOtherReads(
        (memberRows ?? [])
          .filter((row) => row.user_id !== me?.id)
          .map((row) => row.last_read_at as string),
      );
      await supabase.rpc("mark_conversation_read", { conv: activeId });
      void loadConversations();
    };

    void loadThread();

    const channel = supabase.channel(`pager-thread-${activeId}`);
    threadChannel.current = channel;

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
            setMessages((current) =>
              current.some((item) => item.id === next.id) ? current : [...current, next],
            );
            // Mark read immediately for messages we receive
            if (next.sender_id !== me?.id) {
              void supabase.rpc("mark_conversation_read", { conv: activeId });
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
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const userId = payload.userId as string;
        if (!userId || userId === me?.id) return;
        setTyping((current) =>
          current.includes(userId) ? current : [...current, userId],
        );
        window.setTimeout(() => {
          setTyping((current) => current.filter((id) => id !== userId));
        }, 1600);
      })
      .subscribe();

    return () => {
      cancelled = true;
      threadChannel.current = null;
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeId]);

  const active = conversations.find((item) => item.id === activeId) ?? null;
  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    if (me) map.set(me.id, me);
    for (const person of people) map.set(person.id, person);
    for (const conversation of conversations) {
      for (const member of conversation.members ?? []) map.set(member.id, member);
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
    if (!messageQuery.trim()) return true;
    return (message.content ?? "")
      .toLowerCase()
      .includes(messageQuery.trim().toLowerCase());
  });

  const startDm = async (userId: string) => {
    const { data, error } = await supabase.rpc("get_or_create_dm", {
      other_user: userId,
    });
    if (error) throw error;
    await loadConversations();
    setActiveId(data as string);
    setMobileList(false);
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
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: me.id,
      content,
      type: "text",
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    });
    if (error) throw error;
  };

  const uploadFile = async (file: File) => {
    if (!activeId || !me) return;
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
    if (existing) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", me.id)
        .eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: me.id,
        emoji,
      });
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ content: newContent, edited_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) throw error;
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), content: "" })
      .eq("id", messageId);
    if (error) toast.error(error.message);
  };

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

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "rounded-xl");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "rounded-xl");
      }, 1800);
    }
  };

  if (setup === "missing-schema") {
    const handleCopySql = async () => {
      try {
        const res = await fetch("/api/schema");
        const sql = await res.text();
        await navigator.clipboard.writeText(sql);
        setCopiedSql(true);
        toast.success("Database SQL copied to clipboard!");
        setTimeout(() => setCopiedSql(false), 3000);
      } catch {
        toast.error("Could not copy SQL automatically");
      }
    };

    return (
      <div className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">One setup step left</h1>
            <p className="text-sm text-muted-foreground">
              Authentication succeeded, but the database tables and realtime functions are not yet created in your Supabase project.
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium">How to initialize your database:</p>
            <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
              <li>Click <strong>&quot;Copy supabase/schema.sql&quot;</strong> below.</li>
              <li>Open your Supabase project dashboard → <strong>SQL Editor</strong>.</li>
              <li>Paste the script into a new query and click <strong>Run</strong>.</li>
              <li>Click <strong>&quot;I ran the SQL&quot;</strong> below to start chatting.</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleCopySql} variant="default" className="gap-2">
              {copiedSql ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiedSql ? "Copied SQL!" : "Copy supabase/schema.sql"}
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                Open Supabase Dashboard
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="secondary"
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              I ran the SQL
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (setup === "error") {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
        <div className="space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="text-xl font-semibold">Could not load Pager</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {bootError || "An unexpected error occurred while connecting to Supabase."}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={() => window.location.reload()} variant="default">
              Retry
            </Button>
            <Button onClick={() => void signOut()} variant="outline">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (setup === "loading" || !me) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Opening Pager…
      </div>
    );
  }

  const title = active
    ? conversationTitle(active.type, active.name, active.members, me.id)
    : "Select a chat";
  const peer = active?.members.find((member) => member.id !== me.id);
  const typingNames = typing
    .map((id) => profilesById.get(id)?.display_name)
    .filter(Boolean) as string[];

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "w-full shrink-0 border-r md:flex md:w-80 md:flex-col lg:w-96",
          mobileList ? "flex flex-col" : "hidden md:flex",
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-3 p-4">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 min-w-0 flex-1 rounded-md hover:bg-accent p-1 -m-1 transition-colors"
          >
            <UserAvatar
              name={me.display_name}
              src={me.avatar_url}
              size="sm"
            />
            <div className="min-w-0 flex-1 text-left">
              <p className="font-semibold leading-tight truncate">{me.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">@{me.username}</p>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void signOut()}>
            <LogOut />
          </Button>
        </div>

        {/* Search + new chat */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search chats"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button size="icon" onClick={() => setComposerOpen(true)}>
            <Plus />
          </Button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 pb-4">
            {filteredConversations.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                No conversations yet. Start one with the plus button.
              </p>
            ) : (
              filteredConversations.map((conversation) => {
                const label = conversationTitle(
                  conversation.type,
                  conversation.name,
                  conversation.members,
                  me.id,
                );
                const other = conversation.members.find((member) => member.id !== me.id);
                const unread =
                  conversation.last_message &&
                  conversation.last_message.sender_id !== me.id &&
                  new Date(conversation.last_message.created_at) >
                    new Date(conversation.last_read_at);
                const unreadCount = unreadCounts[conversation.id] ?? 0;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setActiveId(conversation.id);
                      setMobileList(false);
                    }}
                    className={cn(
                      "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent",
                      activeId === conversation.id && "bg-accent",
                    )}
                  >
                    {conversation.type === "group" ? (
                      <span className="relative flex size-8 items-center justify-center rounded-full bg-muted">
                        <Users className="size-4" />
                        {unreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="relative">
                        <UserAvatar
                          name={label}
                          src={other?.avatar_url}
                          online={other ? onlineIds.has(other.id) : false}
                        />
                        {unreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm font-medium", unread && "font-semibold")}>{label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {conversation.last_message
                            ? formatListTime(conversation.last_message.created_at)
                            : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "block truncate text-xs text-muted-foreground",
                          unread && "font-medium text-foreground",
                        )}
                      >
                        {previewText(conversation.last_message)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* ── Chat panel ── */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          mobileList ? "hidden md:flex" : "flex",
        )}
      >
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <Button
                className="md:hidden"
                variant="ghost"
                size="sm"
                onClick={() => setMobileList(true)}
              >
                Chats
              </Button>
              {active.type === "group" ? (
                <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Users className="size-4" />
                </span>
              ) : (
                <UserAvatar
                  name={title}
                  src={peer?.avatar_url}
                  online={peer ? onlineIds.has(peer.id) : false}
                  size="lg"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {typingNames.length
                    ? `${typingNames.join(", ")} typing…`
                    : active.type === "group"
                      ? `${active.members.length} members`
                      : peer && onlineIds.has(peer.id)
                        ? "Online"
                        : "Offline"}
                </p>
              </div>
              <div className="hidden w-44 sm:block">
                <Input
                  value={messageQuery}
                  onChange={(event) => setMessageQuery(event.target.value)}
                  placeholder="Search messages"
                />
              </div>
              {active.type === "group" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setGroupInfoOpen(true)}
                  title="Group info"
                >
                  <Info className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // Open peer profile info – not yet implemented, just show avatar
                  }}
                  title="Contact info"
                >
                  <User className="size-4" />
                </Button>
              )}
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4 px-4 py-4">
                {visibleMessages.map((message, index) => {
                  const previous = visibleMessages[index - 1];
                  const showDay =
                    !previous ||
                    formatDay(previous.created_at) !== formatDay(message.created_at);
                  const latestOtherRead = otherReads
                    .map((value) => new Date(value).getTime())
                    .sort((a, b) => b - a)[0];
                  const seen =
                    !!latestOtherRead &&
                    new Date(message.created_at).getTime() <= latestOtherRead;
                  const replyTo = message.reply_to_id
                    ? messagesById.get(message.reply_to_id)
                    : undefined;
                  return (
                    <div
                      key={message.id}
                      ref={(el) => {
                        if (el) messageRefs.current[message.id] = el;
                        else delete messageRefs.current[message.id];
                      }}
                      className="group/message transition-colors"
                    >
                      {showDay ? (
                        <div className="my-3 flex items-center gap-3">
                          <Separator className="flex-1" />
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {formatDay(message.created_at)}
                          </span>
                          <Separator className="flex-1" />
                        </div>
                      ) : null}
                      <MessageItem
                        message={message}
                        mine={message.sender_id === me.id}
                        sender={profilesById.get(message.sender_id)}
                        reactions={reactions.filter(
                          (reaction) => reaction.message_id === message.id,
                        )}
                        mediaUrl={
                          message.file_path ? mediaUrls[message.file_path] : undefined
                        }
                        seen={seen}
                        myId={me.id}
                        replyTo={replyTo}
                        replyToSender={
                          replyTo ? profilesById.get(replyTo.sender_id) : undefined
                        }
                        replyToMediaUrl={
                          replyTo?.file_path ? mediaUrls[replyTo.file_path] : undefined
                        }
                        onReact={(emoji) => void toggleReaction(message.id, emoji)}
                        onEdit={async (newContent) => {
                          await editMessage(message.id, newContent);
                        }}
                        onDelete={() => void deleteMessage(message.id)}
                        onReply={() => setReplyTo(message)}
                        onScrollToReply={
                          message.reply_to_id
                            ? () => scrollToMessage(message.reply_to_id!)
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            <Composer
              onSend={sendText}
              onTyping={emitTyping}
              onUpload={uploadFile}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <MessageCircleDashed className="size-10 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Start with a conversation</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick someone from your team, send a message, then keep going — files,
              groups, and live presence are already wired in.
            </p>
            <Button onClick={() => setComposerOpen(true)}>New chat</Button>
          </div>
        )}
      </section>

      {/* ── Dialogs / Sheets ── */}
      <NewChatDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        people={people}
        onStartDm={startDm}
        onCreateGroup={createGroup}
      />

      <ProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={me}
        onUpdated={(updated) => setMe(updated)}
      />

      {active && active.type === "group" && (
        <GroupInfoSheet
          open={groupInfoOpen}
          onOpenChange={setGroupInfoOpen}
          conversation={active}
          myId={me.id}
          onLeft={() => {
            setActiveId(null);
            void loadConversations();
          }}
        />
      )}
    </div>
  );
}
