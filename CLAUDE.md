@AGENTS.md

# Pager

Real-time team chat: Next.js 16 (App Router) + React 19 + Supabase (Auth, Postgres, Realtime, Storage) + Google Gemini ("Pager AI"). UI is shadcn/Radix + Tailwind 3. Package manager: pnpm.

## Commands
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` (ESLint 9). No test suite.

## Environment
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`). See `.env.example`.

## Next.js specifics
- Middleware lives in root `proxy.ts` (exported `proxy` function), not `middleware.ts`. It calls `lib/supabase/proxy.ts:updateSession`, which refreshes the session and redirects signed-out users to `/auth/login` (except `/`, `/login*`, `/auth*`, `/api*`).
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`.

## Layout
- `app/page.tsx`: landing page.
- `app/chat/page.tsx`: renders `<ChatApp />`, the entire chat app. `app/protected` just redirects to `/chat`.
- `app/auth/*`: login, sign-up, forgot/update password, error pages; `auth/confirm/route.ts` verifies email OTP.
- `app/api/ai/chat/route.ts`: Pager AI. Checks membership, builds history (≤200 messages / 60k chars), calls Gemini (chat or summarize mode, SSE streaming by default), persists the reply via the `send_ai_message` RPC. Outside the user's own AI DM, it only answers when the prompt mentions the bot.
- `app/api/upload/route.ts`: membership check, then `lib/file-safety.ts:validateUpload`, then upload to the `chat-media` bucket at `<conversationId>/<userId>/<uuid>-<name>`.
- `app/api/schema/route.ts`: serves `supabase/schema.sql` as text (used by the setup screen).

### `components/chat/`
- `chat-app.tsx` owns all chat state and side effects: RPC calls (`list_my_conversations`, `get_or_create_dm`, `create_group_chat`, `mark_conversation_read`), realtime channels (`pager-online` presence, `pager-inbox`, `pager-thread-<id>` with postgres changes + `typing` broadcast), sending, reactions, uploads, AI calls.
- Presentational children: `chat-sidebar`, `chat-thread`, `message-item`, `composer`, `formatted-text`, `voice-message-player`, `emoji-picker`, `profile-sheet`, `account-settings`, `user-info-sheet`, `group-info-sheet`, `new-chat-dialog`, `delete-confirm-dialog`, `user-avatar`, `ai-badge`, `icon-button`, `chat-setup-state` (loading/error/missing-schema states).

### `lib/`
- `chat-types.ts`: `Profile`, `Message`, `MessageType`, `Reaction`, `LastMessage`, `ConversationPreview`.
- `ai-bot.ts`: `PAGER_AI_BOT_ID` (`00000000-0000-0000-0000-000000000001`), `PAGER_AI_PROFILE`, `isAiBot`, `isAiDirectChat`, `containsAiMention` (`@ai`, `@pager`, `/ai`, `/ask`, `/summarize`).
- `file-safety.ts`: 10 MB limit, MIME allowlist, blocked extensions, magic-byte sniffing.
- `format.ts` (time/preview/byte formatting), `image.ts` (square crop), `theme-transition.ts`, `ensure-profile.ts`, `utils.ts` (`cn`, `hasEnvVars`).
- `supabase/client.ts` (browser), `supabase/server.ts` (server, cookies), `supabase/proxy.ts` (session refresh).

## Database (`supabase/schema.sql`)
Single idempotent script; run it in the Supabase SQL editor after schema changes.
- Tables: `profiles`, `conversations`, `conversation_members`, `messages`, `message_reactions`, `user_deleted_messages` (per-user "delete for me").
- RPCs: `is_member`, `get_or_create_dm`, `create_group_chat`, `list_my_conversations`, `mark_conversation_read`, `leave_group`, `send_ai_message`.
- Triggers: `on_auth_user_created` creates a profile; `on_message_inserted` bumps `conversations.updated_at`.
- RLS on every table. Realtime publication includes `messages` and `message_reactions`.
- Storage buckets: `chat-media` (private, signed URLs), `avatars` (public), group avatars (members read, creators write).
- Seeds the Pager AI user in `auth.users` + `profiles`.

## Notes
- Leftover Supabase starter files are unused: `components/hero.tsx`, `deploy-button.tsx`, `next-logo.tsx`, `supabase-logo.tsx`, `components/tutorial/*`.
