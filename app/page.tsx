import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageCircleDashed,
  Radio,
  Shield,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";
import { EnvVarWarning } from "@/components/env-var-warning";
import { Suspense } from "react";
import { HeroChatDemo } from "@/components/landing/hero-chat-demo";

export default function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground">
              <MessageCircleDashed className="size-4" />
            </span>
            <span className="text-sm font-semibold">Pager</span>
            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary font-medium">
              v1.2
            </span>
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
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* Headline & CTA */}
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded border border-border/80 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-xs">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[11px] text-foreground">WebSocket Realtime Active</span>
              <span className="text-border">·</span>
              <span>Zero-latency chat</span>
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl text-foreground leading-[1.1]">
              High-velocity chat for modern teams.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Engineered with Supabase Realtime and Next.js. Direct messages, group channels,
              audio waveforms, file exchange, and granular WhatsApp-style message deletion.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="default" className="h-9 px-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/auth/sign-up">
                  Get Started Free <ArrowRight className="size-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="default" className="h-9 px-4 border-border/80 hover:bg-accent">
                <Link href="/chat">
                  Open Chat Session
                </Link>
              </Button>
            </div>
          </div>

          {/* Interactive Live Hero Preview */}
          <div className="pt-4">
            <HeroChatDemo />
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Showcase */}
      <section className="border-t border-border/80 bg-card/20 px-6 py-20">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-primary">Architecture</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Built with precision engineering</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-border/80 bg-card/70 p-5 space-y-3">
              <div className="flex size-8 items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary">
                <Zap className="size-4" />
              </div>
              <h3 className="text-sm font-semibold">Sub-15ms Realtime</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Postgres change notifications broadcasted over resilient WebSocket channels with instant optimistic updates.
              </p>
            </div>

            <div className="rounded border border-border/80 bg-card/70 p-5 space-y-3">
              <div className="flex size-8 items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary">
                <Trash2 className="size-4" />
              </div>
              <h3 className="text-sm font-semibold">Dual Deletion Model</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                WhatsApp-style control: delete for everyone or hide just for yourself with per-user soft-delete ledger tables.
              </p>
            </div>

            <div className="rounded border border-border/80 bg-card/70 p-5 space-y-3">
              <div className="flex size-8 items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary">
                <Shield className="size-4" />
              </div>
              <h3 className="text-sm font-semibold">Row-Level Security</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                PostgreSQL RLS guarantees users only read channels they participate in. Storage buckets locked by session claims.
              </p>
            </div>

            <div className="rounded border border-border/80 bg-card/70 p-5 space-y-3">
              <div className="flex size-8 items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary">
                <Radio className="size-4" />
              </div>
              <h3 className="text-sm font-semibold">Waveforms & Voice</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Native voice recorder with live duration timer, interactive waveform scrubber, and instant drag-and-drop file sharing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-border/80 px-6 py-8 bg-card/30">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded bg-primary text-primary-foreground font-mono text-[10px]">
              P
            </span>
            <span>Pager · Open communication infrastructure.</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <Link href="/chat" className="hover:text-foreground transition-colors">
              Chat
            </Link>
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/auth/sign-up" className="hover:text-foreground transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
