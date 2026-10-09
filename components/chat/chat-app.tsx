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
      setHiddenMessageIds(new Set());
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

    const loadThread = async () => {
      const [{ data: rows }, { data: reactionRows }, { data: hiddenRows }] =
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
            .from("user_deleted_messages")
            .select("message_id")
            .eq("user_id", me?.id ?? ""),
        ]);

      if (cancelled) return;
      setMessages((rows ?? []) as Message[]);
      setReactions((reactionRows ?? []) as Reaction[]);
      setHiddenMessageIds(
        new Set((hiddenRows ?? []).map((r: { message_id: string }) => r.message_id)),
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
              current.some((item) => item.id === next.id)
                ? current
                : current.some(
                      (item) =>
                        optimisticMessageIds.current.has(item.id) &&
                        item.sender_id === next.sender_id &&
                        item.conversation_id === next.conversation_id &&
                        item.content === next.content &&
                        item.reply_to_id === next.reply_to_id,
                    )
                  ? current.map((item) => {
                      if (
                        !optimisticMessageIds.current.has(item.id) ||
                        item.sender_id !== next.sender_id ||
                        item.conversation_id !== next.conversation_id ||
                        item.content !== next.content ||
                        item.reply_to_id !== next.reply_to_id
                      ) {
                        return item;
                      }
                      optimisticMessageIds.current.delete(item.id);
                      return next;
                    })
                  : [...current, next],
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
    // Filter out messages the user has hidden via "Delete for me"
    if (hiddenMessageIds.has(message.id)) return false;
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
