import Link from "next/link";
import { Suspense } from "react";
import { FileAudio, Lock, Sparkles, Zap } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";
import { EnvVarWarning } from "@/components/env-var-warning";
import { HeroChatDemo } from "@/components/landing/hero-chat-demo";
import { HeroBackdrop } from "@/components/landing/hero-backdrop";
import { PagerMark } from "@/components/pager-mark";

const FEATURES = [
  {
    icon: Zap,
    title: "Real-time by default",
    body: "Messages, reactions, typing indicators and presence update instantly for everyone in the conversation.",
  },
  {
    icon: FileAudio,
    title: "Voice notes and files",
    body: "Record a voice note, paste a screenshot, or share a PDF without leaving the conversation.",
  },
  {
    icon: Sparkles,
    title: "An AI teammate",
    body: "Mention @ai to ask a question in any chat, or summarize a long thread when you've been away.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Row-level security means people only ever see the conversations they belong to.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <PagerMark />
            <span className="text-[15px] font-semibold tracking-tight">Pager</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </div>
      </nav>

      <section className="relative isolate px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
        <HeroBackdrop />
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Team chat that keeps up with you
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Direct messages, group conversations, voice notes and file sharing, plus an AI
              teammate that can catch you up on any thread.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="px-6">
                <Link href="/auth/sign-up">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="px-6">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16">
            <HeroChatDemo />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything a team conversation needs
          </h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <span className="flex size-9 items-center justify-center rounded-lg border bg-background text-foreground">
                  <feature.icon className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <PagerMark className="size-5" />
            <span>Pager</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="transition-colors hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
