# Pager · Real-Time Team Chat

> Built for the **FIRST COMMIT** Hackathon organized by **KAMAND PROMPT | IIT MANDI**.
> A real-time team chat app built with **Next.js 16**, **React 19**, **Supabase** (Auth, Postgres, Realtime, Storage), **Google Gemini**, **shadcn/ui** and **Tailwind CSS**.

---

## 🌟 Overview

**Pager** is a web chat app for one-to-one and group conversations, with images, voice notes and files, live presence, typing and read receipts. It also has **Pager AI**, a built-in teammate powered by Google Gemini that you can chat with directly or call into any conversation to answer questions or summarize the thread.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   (Next.js App Router, React 19, shadcn/ui, Tailwind CSS)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
         HTTPS │ API requests                 │ WebSocket channels
               ▼                              ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│        Next.js Server         │ │     Supabase Realtime     │
│  - proxy.ts session refresh   │ │  • Presence (online)      │
│  - /api/upload (file checks)  │ │  • Broadcast (typing,     │
│  - /api/ai/chat (Pager AI) ───┼─┼──► Gemini API   read)    │
│  - /api/schema (setup SQL)    │ │  • Postgres changes       │
└──────────────┬────────────────┘ └───────────────────────────┘
               │ User's JWT
               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Postgres                       │
│  Tables + RPCs, Row-Level Security on every table           │
│  Storage: chat-media (private) · avatars · group-avatars    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Features

### Core
- **Authentication:** email and password sign-up, login, password reset and sign-out with Supabase Auth. Sessions are kept in cookies via `@supabase/ssr`, and a profile with a unique username is created automatically on sign-up.
- **Direct messages:** start a 1:1 chat with anyone; the existing conversation is reused if there is one (`get_or_create_dm`).
- **Real-time delivery:** messages appear instantly over Supabase Realtime, with optimistic sending so your own messages show up before the server confirms them.

### Pager AI
- **AI direct chat:** open a chat with Pager AI from the new-chat dialog; it answers every message there.
- **Mentions in any chat:** in DMs and groups, Pager AI only replies when called with `@ai`, `@pager`, `/ai` or `/ask`.
- **Summaries:** the summarize button, or typing `/summarize`, produces a summary of key topics, decisions and action items.
- **Context-aware:** it sees up to the last 200 messages (about 60k characters), knows who said what, and follows replies. Responses stream in token by token and are saved as normal messages.

### Groups
- Create named groups and pick members.
- Group info panel with the member list, an admin badge, and a changeable group photo (any member can change it).
- Leave a group from an in-app confirmation dialog. If the admin leaves, the longest-standing member becomes admin; when the last person leaves, the group is deleted.

### Messages
- **Images, voice notes and files:** images render inline (served via signed URLs), voice notes are recorded in the browser with `MediaRecorder` and played back with a waveform player, and documents show their name and size. Paste screenshots straight into the composer with `Ctrl+V` / `Cmd+V`.
- **Formatting:** bold, italic, strikethrough, inline code, code blocks, headings, quotes, lists and links, with a toolbar and shortcuts (`Ctrl+B`, `Ctrl+I`, `Ctrl+E`, `Ctrl+Shift+X`).
- **Replies:** reply to a message; clicking the quoted reply scrolls to and highlights the original.
- **Editing:** edit your messages inline; edited messages are marked.
- **Deleting:** "Delete for everyone" (your own messages) or "Delete for me" (hides it only for you). Select several messages to delete them at once.
- **Reactions:** react from an emoji picker grouped by category; click a reaction to add or remove yours.
- **Search:** filter the open conversation by message text.

### Presence and status
- **Online indicators:** a green dot shows who is online.
- **Typing indicator:** a typing bubble shows who is typing.
- **Read receipts:** shows whether a message is sending, sent, read by some members, or read by everyone, and updates live.
- **Unread badges:** unread counts on conversations in the sidebar.

### Account and appearance
- **Profile:** edit your display name, username and bio, and upload an avatar (cropped to a square automatically).
- **Account settings:** change your email address, or change your password (your current password is checked first).
- **Theme:** light and dark themes with an animated transition.
- **Setup helper:** if the database schema is missing, the app shows a setup screen that copies `supabase/schema.sql` to your clipboard.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack, Cache Components) |
| **UI** | React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 3.4, `tailwindcss-animate`, `next-themes` |
| **Components** | shadcn/ui (Radix UI primitives, Lucide icons, Sonner toasts) |
| **Database & Realtime** | Supabase Postgres with Row-Level Security and Realtime |
| **Authentication** | Supabase Auth (`@supabase/ssr`) |
| **Storage** | Supabase Storage (`chat-media`, `avatars`, `group-avatars`) |
| **AI** | Google Gemini via `@google/genai` (default model `gemini-3.5-flash-lite`) |

---

## 📦 Local Setup

### Prerequisites
- **Node.js** 20.9 or newer (required by Next.js 16)
- **pnpm**
- A free **Supabase** project ([supabase.com](https://supabase.com))
- A free **Gemini API key** from [Google AI Studio](https://aistudio.google.com/) (only needed for Pager AI)

### 1. Clone and install
```bash
git clone <repository-url>
cd pager
pnpm install
```

### 2. Configure environment variables
```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key

# Pager AI
GEMINI_API_KEY=your-gemini-api-key
# Optional model override (defaults to gemini-3.5-flash-lite)
# GEMINI_MODEL=gemini-3.5-flash-lite
```

The app runs without `GEMINI_API_KEY`; Pager AI will just show a message asking you to add it.

### 3. Set up the database
1. Open your Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

The script is safe to run more than once, so re-run it after pulling schema changes. It creates:
- **Tables:** `profiles`, `conversations`, `conversation_members`, `messages`, `message_reactions`, `user_deleted_messages`
- **Functions:** `get_or_create_dm`, `create_group_chat`, `list_my_conversations`, `mark_conversation_read`, `leave_group`, `send_ai_message`, plus membership helpers
- **Triggers:** profile creation on sign-up, conversation ordering by latest message, and protection of group ownership fields
- **Security:** Row-Level Security policies on every table and storage bucket
- **Realtime:** publication of `messages`, `message_reactions` and `conversation_members`
- **Storage buckets:** `chat-media` (private), `avatars` (public), `group-avatars`
- **Pager AI:** the bot's user account and profile

If you skip this step, the app shows a setup screen with a button that copies the SQL for you.

### 4. Configure Supabase Auth
In the Supabase Dashboard:
- **Authentication → Providers → Email:** for local testing without an email server, turn off **Confirm email**. If you keep it on, confirmation links are handled by `/auth/confirm`.
- **Authentication → URL Configuration:** add `http://localhost:3000/**` to the redirect URLs.

### 5. Run the app
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).

### Scripts
| Command | Description |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build` | Build for production |
| `pnpm start` | Run the production build |
| `pnpm lint` | Run ESLint |

---

## 📁 Project Structure

```
app/
  page.tsx                 Landing page
  chat/page.tsx            The chat app
  auth/                    Login, sign-up, password reset, email confirmation
  api/ai/chat/route.ts     Pager AI (Gemini, streaming)
  api/upload/route.ts      Validated file uploads
  api/schema/route.ts      Serves schema.sql for the setup screen
components/
  chat/                    Chat UI; chat-app.tsx holds the state and realtime logic
  landing/                 Landing page hero and demo
  ui/                      shadcn/ui components
lib/
  supabase/                Browser, server and session-refresh clients
  ai-bot.ts                Pager AI identity and mention detection
  file-safety.ts           Upload validation
supabase/schema.sql        Full database setup script
proxy.ts                   Session refresh and sign-in redirects
```

---

## 🧪 Trying It Out

To test real-time features with two users:

1. **Open two browser sessions**, for example a normal window and a private window.
2. **Sign up User A** in one window and **User B** in the other.
3. **Direct chat:** as User A, click **New chat**, pick User B and send a message. It appears instantly for User B.
4. **Presence, typing and receipts:** check the green online dot, type as User A to see the typing bubble for User B, and watch the receipt change to "read" once User B opens the chat.
5. **Media:** send an image, record a voice note, or paste a screenshot with `Ctrl+V`, then check it plays or displays for the other user.
6. **Replies, reactions and edits:** react to a message, reply to it, click the quoted reply to jump back, and edit one of your messages.
7. **Groups:** create a group with both users, change its photo, then leave it from the group info panel.
8. **Pager AI:** start a chat with Pager AI, then in the group type `@ai what have we decided so far?` or press the summarize button.
9. **Deleting:** select several messages and try "Delete for me" and "Delete for everyone".

---

## 🔒 Security

- **No service keys in the browser:** the client only uses the publishable key. All data and file access is enforced by Postgres Row-Level Security using the user's session.
- **Membership checks:** users can only read conversations, messages, reactions and files in chats they belong to. The upload and AI routes also check membership on the server.
- **Upload validation** (`lib/file-safety.ts`):
  - 10 MB limit per file.
  - Allowlist of JPEG, PNG, GIF, WebP, PDF, plain text and common audio formats.
  - File contents are checked by magic bytes, so a file can't pass by just renaming it.
  - Executables, scripts, HTML and SVG are blocked.
- **Private media:** chat attachments live in a private bucket and are served through short-lived signed URLs.
- **Protected group ownership:** members can change a group's photo, but a database trigger prevents clients from changing its owner or type.