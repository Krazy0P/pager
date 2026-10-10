"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PagerMark } from "@/components/pager-mark";

export function ChatSetupState({
  onSignOut,
}: {
  onSignOut: () => void;
}) {
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = async () => {
    try {
      const res = await fetch("/api/schema");
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      toast.success("Database SQL copied to clipboard!");
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      toast.error("Could not copy SQL automatically");
    }
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">One setup step left</h1>
          <p className="text-sm text-muted-foreground">
            Authentication succeeded, but the database tables and realtime functions are not yet created in your Supabase project.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium">How to initialize your database:</p>
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
            <li>Click <strong>&quot;Copy supabase/schema.sql&quot;</strong> below.</li>
            <li>Open your Supabase project dashboard → <strong>SQL Editor</strong>.</li>
            <li>Paste the script into a new query and click <strong>Run</strong>.</li>
            <li>Click <strong>&quot;I ran the SQL&quot;</strong> below to start chatting.</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={handleCopySql} variant="default" className="gap-2">
            {copiedSql ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiedSql ? "Copied SQL!" : "Copy supabase/schema.sql"}
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Open Supabase Dashboard
              <ExternalLink className="size-4" />
            </a>
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            I ran the SQL
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function ChatErrorState({
  message,
  onSignOut,
}: {
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <div className="space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <h2 className="text-xl font-semibold">Could not load Pager</h2>
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {message || "An unexpected error occurred while connecting to Supabase."}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={() => window.location.reload()} variant="default">
            Retry
          </Button>
          <Button onClick={onSignOut} variant="outline">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChatLoadingState() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4" role="status">
      <PagerMark className="size-9" />
      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
