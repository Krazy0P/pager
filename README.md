# Pager · Real-Time Chat Application

> Built for the **FIRST COMMIT** Hackathon organized by **KAMAND PROMPT | IIT MANDI**.
> A modern, real-time messaging application powered by **Next.js 16**, **Supabase Realtime (WebSockets)**, **Supabase Auth & Storage**, **shadcn/ui**, and **Tailwind CSS**.

---

## 🌟 Overview & Architecture

**Pager** is a high-performance web-based chat platform delivering instant one-to-one and group messaging with rich multimedia support, end-to-end user session management, and real-time interaction states.

### Architectural Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   (Next.js App Router, React 19, shadcn/ui, Tailwind CSS)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
         HTTPS │ API Requests                 │ WebSocket Channels
               ▼                              ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│       Next.js Server          │ │     Supabase Service      │
│  - Middleware Session Refresh │ │  - Realtime WebSockets    │
│  - /api/upload (Safety Sniff) │ │    • Presence (online)    │
└──────────────┬────────────────┘ │    • Broadcast (typing)   │
               │                  │    • Postgres Changes     │
         Token │ Verified         │  - Row-Level Security     │
               ▼                  │  - Storage Buckets        │
┌───────────────────────────────┐ │    • chat-media (private) │
│       Supabase Postgres       │ │    • avatars (public)     │
│  (Profiles, Convs, Messages)  │ └───────────────────────────┘
└───────────────────────────────┘
```

---

## 🚀 Key Features

### 1. Mandatory Core Requirements
- **Authentication & User Sessions:**
  - Secure email & password signup, login, password recovery, and signout via Supabase Auth.
  - SSR cookie session synchronization via `@supabase/ssr` middleware.
  - Automatic profile generation upon registration.
- **One-to-One Real-Time Chat:**
  - Instant direct messaging between registered users with idempotent conversation lookup (`get_or_create_dm`).
  - Low-latency real-time message delivery over Supabase Realtime WebSockets.
  - Accurate user attribution and timestamping.

### 2. Feature Depth & Extensions
- **Group Conversations:**
  - Create multi-user channels with custom names and member selection.
  - Group details panel with full member list and admin indicators.
  - Ability to leave group conversations.
- **Rich Multimedia Messaging:**
  - **Images & Photos:** Inline rendering with signed URLs for security.
  - **Voice Notes:** Built-in audio recorder via `MediaRecorder` API with waveform audio player.
  - **File Sharing & Documents:** PDF and document transfer with formatted file sizes.
  - **Clipboard Image Paste:** Paste screenshots directly into the chat composer (`Ctrl+V` / `Cmd+V`).
- **File Safety & Security:**
  - Content sniffing by magic-bytes (validating genuine JPEG, PNG, GIF, WebP, PDF, WebM, MP3, WAV headers).
  - Explicit blocklist rejecting executables, scripts, and unsafe extensions (`.exe`, `.sh`, `.js`, etc.).
  - 10MB per-file upload threshold.
  - Storage protected under Row-Level Security (RLS) conversation membership policies.
- **Contextual Conversation Utilities:**
  - **Reply-to-Message:** Reply to specific messages; clicking the reply banner smoothly scrolls to the original message and highlights it.
  - **Inline Message Editing:** Edit messages directly within the chat bubble with quick save/cancel controls.
  - **Soft Message Deletion:** Retain conversation flow while scrubbing deleted contents.
  - **Full Emoji Picker:** Category-sorted emoji picker (Smileys, Gestures, Objects) with live search and message reactions.
  - **Live Presence & Typing Indicators:** Real-time online/offline green status indicator and typing alerts.
  - **Read Receipts:** Double checkmark indicators verifying when peers have read messages.
  - **Live Message Search:** Instant filter searching messages across the active chat thread.
  - **User Profile Management:** Edit your display name, bio, and upload custom avatars to Supabase Storage.
  - **Unread Message Badges:** Real-time unread counts badge on conversation items.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router with Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 3.4, `tailwindcss-animate` |
| **Components** | shadcn/ui (Radix UI Primitives, Lucide Icons, Sonner) |
| **Database & Realtime** | Supabase Postgres with Row Level Security & Realtime Publications |
| **Authentication** | Supabase Auth (`@supabase/ssr`) |
| **Storage** | Supabase Storage (`chat-media` & `avatars` buckets) |

---

## 📦 Local Setup Instructions

### Prerequisites
- **Node.js** >= 18.18.0
- **pnpm** (or `npm` / `yarn`)
- A free **Supabase** project ([supabase.com](https://supabase.com))

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd pager
pnpm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```

Add your Supabase project credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
```

### 3. Initialize Database Schema
1. Open your Supabase Dashboard → **SQL Editor** → **New query**.
2. Copy and paste the contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Click **Run**. This will create:
   - Tables: `profiles`, `conversations`, `conversation_members`, `messages`, `message_reactions`
   - Indexes and Row Level Security (RLS) policies
   - Realtime publication rules
   - Stored functions: `get_or_create_dm`, `create_group_chat`, `list_my_conversations`, `mark_conversation_read`
   - Storage buckets: `chat-media` (private) and `avatars` (public)

### 4. Supabase Auth Configuration (for development)
In the Supabase Dashboard:
- Go to **Authentication** → **Providers** → **Email**:
  - Turn off **"Confirm email"** to allow immediate testing without an SMTP server.
- Go to **Authentication** → **URL Configuration**:
  - Add `http://localhost:3000/**` to redirect URLs.

### 5. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing in a Clean Environment

To verify full real-time functionality between multiple users:

1. **Open two separate browser sessions** (e.g., standard browser and an Incognito/Private window).
2. **Register User A** in Window 1 (`alice@example.com`).
3. **Register User B** in Window 2 (`bob@example.com`).
4. **Initiate Direct Chat:**
   - In Window 1, click **"+" (New chat)**, search for Bob, and start the conversation.
   - Send a text message — User B receives it instantly via WebSockets without page reload.
5. **Presence & Typing:**
   - Notice the green online status indicator on user avatars.
   - Type in User A's input box — observe the live typing indicator in User B's header.
6. **Rich Media & Voice:**
   - Upload an image or record a voice note in Window 1.
   - Verify playback and media display in Window 2.
   - Try copying an image from your computer and pressing `Ctrl+V` in the message box.
7. **Reactions & Replies:**
   - Hover over a message, click the emoji button or picker to add a reaction.
   - Select **Reply** from the menu, type a response, and observe the reply preview banner.
   - Click the reply banner on the sent message to jump directly to the referenced message.
8. **Profile Customization:**
   - Click your profile card in the sidebar header to open the profile editor.
   - Change your display name or upload an avatar photo.

---

## 🔒 Security & Best Practices

- **Zero Client Service Keys:** Only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is exposed on the client. Database updates and bucket access are strictly governed by Postgres RLS and JWT verification.
- **Row-Level Security (RLS):** Users can only query messages and conversations they are verified members of.
- **MIME & Magic-Byte Sniffing:** Prevents disguised malicious payloads on file uploads.
