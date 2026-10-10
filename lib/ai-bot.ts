import type { Profile } from "@/lib/chat-types";

export const PAGER_AI_BOT_ID = "00000000-0000-0000-0000-000000000001";

export const PAGER_AI_PROFILE: Profile = {
  id: PAGER_AI_BOT_ID,
  username: "ai",
  display_name: "Pager AI",
  avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=pager-ai",
  bio: "Context-aware AI teammate powered by Google Gemini",
};

/**
 * Returns true if the user ID matches the Pager AI bot.
 */
export function isAiBot(userId?: string | null): boolean {
  if (!userId) return false;
  return userId === PAGER_AI_BOT_ID;
}

/**
 * Returns true only for the user's own 1:1 chat with Pager AI. DMs between
 * people and group chats don't count, even if the bot has posted there.
 */
export function isAiDirectChat(
  conversation?: { type: string; members: { id: string }[] } | null,
): boolean {
  if (!conversation || conversation.type !== "direct") return false;
  return (
    conversation.members.length === 2 &&
    conversation.members.some((m) => m.id === PAGER_AI_BOT_ID)
  );
}

/**
 * Detects if a message text is asking for Pager AI via @ai, @pager, or /ai
 */
export function containsAiMention(text?: string | null): boolean {
  if (!text) return false;
  return /(?:^|\s)(?:@ai|@pager|\/ai|\/ask|\/summarize)\b/i.test(text);
}
