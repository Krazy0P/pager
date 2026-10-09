import Link from "next/link";
import { MessageCircleDashed, Radio, Shield, Zap } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";
import { EnvVarWarning } from "@/components/env-var-warning";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-svh bg-background">
      <nav className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageCircleDashed className="size-4" />
          </span>
          Pager
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <Suspense>
              <AuthButton />
            </Suspense>
          )}
        </div>
      </nav>
      <section className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-20">
        <div className="max-w-2xl space-y-5">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            First Commit · Real-time chat
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Start with a conversation. Build whatever comes next.
          </h1>
          <p className="text-lg text-muted-foreground">
            Pager is a live messaging app with authenticated sessions, one-to-one
            and group chats, file sharing, and presence — powered by Next.js and
            Supabase Realtime.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/auth/sign-up">Create an account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/chat">Open chat</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Realtime delivery",
              body: "Messages, typing, and online status ride Supabase WebSockets.",
            },
            {
              icon: Shield,
              title: "Private by default",
              body: "Row-level security plus a private storage bucket for media.",
            },
            {
              icon: Radio,
              title: "More than text",
              body: "Images, voice notes, files, reactions, receipts, and groups.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border p-5">
              <item.icon className="mb-3 size-5" />
              <h2 className="font-medium">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
