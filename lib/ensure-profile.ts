import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/chat-types";

export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const { data, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (data) return data as Profile;

  const emailName = user.email?.split("@")[0] ?? "user";
  const username = (user.user_metadata?.username as string | undefined) ?? emailName;
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? emailName;

  const { data: created, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      username: username.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 24) ||
        `user${user.id.slice(0, 6)}`,
      display_name: displayName,
    })
    .select("*")
    .single();

  if (error) throw error;
  return created as Profile;
}
