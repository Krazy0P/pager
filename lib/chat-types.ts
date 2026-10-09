export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at?: string;
};

export type MessageType = "text" | "image" | "audio" | "file";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: MessageType;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type Reaction = {
  message_id: string;
  user_id: string;
  emoji: string;
};

export type LastMessage = {
  id: string;
  content: string | null;
  type: MessageType;
  sender_id: string;
  created_at: string;
  deleted_at: string | null;
};

export type ConversationPreview = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_read_at: string;
  last_message: LastMessage | null;
  members: Profile[];
};
