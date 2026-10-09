export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatListTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatClock(iso);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function previewText(message: {
  content: string | null;
  type: string;
  deleted_at: string | null;
} | null) {
  if (!message) return "No messages yet";
  if (message.deleted_at) return "Message deleted";
  if (message.type === "image") return "Photo";
  if (message.type === "audio") return "Voice note";
  if (message.type === "file") return "File";
  return message.content || "Message";
}

export function conversationTitle(
  type: "direct" | "group",
  name: string | null,
  members: { id: string; display_name: string }[],
  myId: string,
) {
  if (type === "group") return name || "Group";
  return members.find((m) => m.id !== myId)?.display_name ?? "Direct message";
}

export function formatBytes(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
