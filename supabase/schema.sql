-- Pager chat schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,
  avatar_url text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists avatar_url text;

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text,
  type text not null default 'text' check (type in ('text', 'image', 'audio', 'file')),
  file_path text,
  file_name text,
  file_type text,
  file_size integer,
  reply_to_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);
create index if not exists messages_content_idx
  on public.messages using gin (to_tsvector('simple', coalesce(content, '')));

-- Membership helper (avoids recursive RLS)
create or replace function public.is_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = conv
      and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  unique_name text;
  suffix int := 0;
begin
  base_name := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1),
    'user'
  );
  base_name := lower(regexp_replace(base_name, '[^a-z0-9_]+', '', 'g'));
  if length(base_name) < 3 then
    base_name := 'user' || substr(new.id::text, 1, 6);
  end if;

  unique_name := base_name;
  while exists (select 1 from public.profiles where username = unique_name) loop
    suffix := suffix + 1;
    unique_name := base_name || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    unique_name,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), unique_name)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute function public.touch_conversation();

create or replace function public.get_or_create_dm(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_user = me then
    raise exception 'Cannot start a chat with yourself';
  end if;
  if not exists (select 1 from public.profiles where id = other_user) then
    raise exception 'User not found';
  end if;

  select c.id into conv_id
  from public.conversations c
  join public.conversation_members m1
    on m1.conversation_id = c.id and m1.user_id = me
  join public.conversation_members m2
    on m2.conversation_id = c.id and m2.user_id = other_user
  where c.type = 'direct'
    and (
      select count(*) from public.conversation_members cm
      where cm.conversation_id = c.id
    ) = 2
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  insert into public.conversations (type, created_by)
  values ('direct', me)
  returning id into conv_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (conv_id, me), (conv_id, other_user);

  return conv_id;
end;
$$;

create or replace function public.create_group_chat(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
  member uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) < 1 then
    raise exception 'Group name is required';
  end if;

  insert into public.conversations (type, name, created_by)
  values ('group', trim(p_name), me)
  returning id into conv_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (conv_id, me);

  foreach member in array p_member_ids loop
    if member is distinct from me and exists (select 1 from public.profiles where id = member) then
      insert into public.conversation_members (conversation_id, user_id)
      values (conv_id, member)
      on conflict do nothing;
    end if;
  end loop;

  return conv_id;
end;
$$;

create or replace function public.list_my_conversations()
returns table (
  id uuid,
  type text,
  name text,
  avatar_url text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_read_at timestamptz,
  last_message jsonb,
  members jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.type,
    c.name,
    c.avatar_url,
    c.created_by,
    c.created_at,
    c.updated_at,
    my.last_read_at,
    (
      select jsonb_build_object(
        'id', m.id,
        'content', m.content,
        'type', m.type,
        'sender_id', m.sender_id,
        'created_at', m.created_at,
        'deleted_at', m.deleted_at
      )
      from public.messages m
      where m.conversation_id = c.id
      order by m.created_at desc
      limit 1
    ) as last_message,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url
      ) order by p.display_name), '[]'::jsonb)
      from public.conversation_members cm2
      join public.profiles p on p.id = cm2.user_id
      where cm2.conversation_id = c.id
    ) as members
  from public.conversations c
  join public.conversation_members my
    on my.conversation_id = c.id and my.user_id = auth.uid()
  order by c.updated_at desc;
$$;

create or replace function public.mark_conversation_read(conv uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_members
  set last_read_at = now()
  where conversation_id = conv
    and user_id = auth.uid();
$$;

create or replace function public.leave_group(conv uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.conversations
    where id = conv
      and type = 'group'
      and public.is_member(conv)
  ) then
    raise exception 'You are not a member of this group';
  end if;

  delete from public.conversation_members
  where conversation_id = conv
    and user_id = auth.uid();
end;
$$;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "members read conversations" on public.conversations;
create policy "members read conversations"
  on public.conversations for select
  to authenticated
  using (public.is_member(id));

drop policy if exists "users create conversations" on public.conversations;
create policy "users create conversations"
  on public.conversations for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "creators update conversations" on public.conversations;
create policy "creators update conversations"
  on public.conversations for update
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "members read membership" on public.conversation_members;
create policy "members read membership"
  on public.conversation_members for select
  to authenticated
  using (public.is_member(conversation_id));

drop policy if exists "users update own membership" on public.conversation_members;
create policy "users update own membership"
  on public.conversation_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users leave conversations" on public.conversation_members;
create policy "users leave conversations"
  on public.conversation_members for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "members read messages" on public.messages;
create policy "members read messages"
  on public.messages for select
  to authenticated
  using (public.is_member(conversation_id));

drop policy if exists "members send messages" on public.messages;
create policy "members send messages"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));

drop policy if exists "senders update messages" on public.messages;
create policy "senders update messages"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "members read reactions" on public.message_reactions;
create policy "members read reactions"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_member(m.conversation_id)
    )
  );

drop policy if exists "members write reactions" on public.message_reactions;
create policy "members write reactions"
  on public.message_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_member(m.conversation_id)
    )
  );

drop policy if exists "users delete own reactions" on public.message_reactions;
create policy "users delete own reactions"
  on public.message_reactions for delete
  to authenticated
  using (user_id = auth.uid());

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;
grant execute on function public.list_my_conversations() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;

alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;
alter table public.conversation_members replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

drop policy if exists "members upload chat media" on storage.objects;
create policy "members upload chat media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members read chat media" on storage.objects;
create policy "members read chat media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "owners delete chat media" on storage.objects;
create policy "owners delete chat media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-media'
    and owner = auth.uid()
  );

-- Migration: add reply_to_id if not present (idempotent)
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

-- Avatar / profile-pictures bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "anyone reads avatars" on storage.objects;
create policy "anyone reads avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and owner = auth.uid()
  );

-- Group avatar bucket
insert into storage.buckets (id, name, public)
values ('group-avatars', 'group-avatars', true)
on conflict (id) do nothing;

drop policy if exists "members read group avatars" on storage.objects;
create policy "members read group avatars"
  on storage.objects for select
  using (
    bucket_id = 'group-avatars'
    and public.is_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "group creators upload avatars" on storage.objects;
create policy "group creators upload avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'group-avatars'
    and exists (
      select 1 from public.conversations
      where id = (storage.foldername(name))[1]::uuid
        and created_by = auth.uid()
    )
  );

drop policy if exists "group creators update avatars" on storage.objects;
create policy "group creators update avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'group-avatars'
    and exists (
      select 1 from public.conversations
      where id = (storage.foldername(name))[1]::uuid
        and created_by = auth.uid()
    )
  );

-- ─── "Delete for me" feature ───────────────────────────────────────────────
-- Tracks messages that a user has hidden from their own view only.
-- This is separate from deleted_at (which is "delete for everyone").
create table if not exists public.user_deleted_messages (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.user_deleted_messages enable row level security;

drop policy if exists "users manage own deleted messages" on public.user_deleted_messages;
create policy "users manage own deleted messages"
  on public.user_deleted_messages for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant all on public.user_deleted_messages to authenticated;
