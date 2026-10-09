"use client";

import { Info, MessageCircleDashed, User, Users } from "lucide-react";
import type { ConversationPreview, Message, Profile, Reaction } from "@/lib/chat-types";
import { formatDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/chat/user-avatar";
import { MessageItem } from "@/components/chat/message-item";
import { Composer } from "@/components/chat/composer";
import { cn } from "@/lib/utils";

export function ChatThread({
  active,
  me,
  title,
  peer,
  onlineIds,
  typingNames,
  mobileList,
  visibleMessages,
  messagesById,
  profilesById,
  reactions,
  mediaUrls,
  otherReads,
  messageQuery,
  replyTo,
  bottomRef,
  messageRefs,
  onBack,
  onMessageQueryChange,
  onOpenGroupInfo,
  onOpenNewChat,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  onReply,
  onScrollToMessage,
  onSend,
  onTyping,
  onUpload,
  onClearReply,
}: {
  active: ConversationPreview | null;
  me: Profile;
  title: string;
  peer: Profile | undefined;
  onlineIds: Set<string>;
  typingNames: string[];
  mobileList: boolean;
  visibleMessages: Message[];
  messagesById: Map<string, Message>;
  profilesById: Map<string, Profile>;
  reactions: Reaction[];
  mediaUrls: Record<string, string>;
  otherReads: string[];
  messageQuery: string;
  replyTo: Message | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
  onBack: () => void;
  onMessageQueryChange: (value: string) => void;
  onOpenGroupInfo: () => void;
  onOpenNewChat: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  onReply: (message: Message) => void;
  onScrollToMessage: (id: string) => void;
  onSend: (content: string, replyToId?: string) => Promise<void>;
  onTyping: () => void;
  onUpload: (file: File) => Promise<void>;
  onClearReply: () => void;
}) {
  return (
    <section
      className={cn(
        "min-w-0 flex-1 flex-col",
        mobileList ? "hidden md:flex" : "flex",
      )}
    >
      {active ? (
        <>
          <header className="flex items-center gap-3 border-b px-4 py-3">
            <Button className="md:hidden" variant="ghost" size="sm" onClick={onBack}>
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
                onChange={(event) => onMessageQueryChange(event.target.value)}
                placeholder="Search messages"
              />
            </div>
            {active.type === "group" ? (
              <Button variant="ghost" size="icon" onClick={onOpenGroupInfo} title="Group info">
                <Info className="size-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" title="Contact info">
                <User className="size-4" />
              </Button>
            )}
          </header>

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
                const reply = message.reply_to_id
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
                      mediaUrl={message.file_path ? mediaUrls[message.file_path] : undefined}
                      seen={seen}
                      myId={me.id}
                      replyTo={reply}
                      replyToSender={reply ? profilesById.get(reply.sender_id) : undefined}
                      replyToMediaUrl={reply?.file_path ? mediaUrls[reply.file_path] : undefined}
                      onReact={(emoji) => onToggleReaction(message.id, emoji)}
                      onEdit={(content) => onEditMessage(message.id, content)}
                      onDelete={() => onDeleteMessage(message.id)}
                      onReply={() => onReply(message)}
                      onScrollToReply={
                        message.reply_to_id
                          ? () => onScrollToMessage(message.reply_to_id!)
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
            onSend={onSend}
            onTyping={onTyping}
            onUpload={onUpload}
            replyTo={replyTo}
            onClearReply={onClearReply}
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
          <Button onClick={onOpenNewChat}>New chat</Button>
        </div>
      )}
    </section>
  );
}
