import Link from "next/link";
import { connection } from "next/server";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? (
    <div className="flex items-center gap-2">
      <LogoutButton />
      <Button asChild size="sm">
        <Link href="/chat">Open Pager</Link>
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-1">
      <Button asChild size="sm" variant="ghost">
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/auth/sign-up">Get started</Link>
      </Button>
    </div>
  );
}
