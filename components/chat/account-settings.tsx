"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Supabase's default minimum; projects can raise it, in which case the API error is shown
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Change the signed-in user's email address and password. */
export function AccountSettings() {
  const supabase = createClient();
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user?.email) {
        setLoadFailed(true);
        return;
      }
      setCurrentEmail(data.user.email);
      setPendingEmail(data.user.new_email ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadFailed) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Couldn&apos;t load your account details. Try reopening settings.
      </p>
    );
  }

  if (currentEmail === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <EmailForm
        currentEmail={currentEmail}
        pendingEmail={pendingEmail}
        onChanged={(email, pending) => {
          if (pending) setPendingEmail(email);
          else {
            setCurrentEmail(email);
            setPendingEmail(null);
          }
        }}
      />
      <div className="border-t" />
      <PasswordForm currentEmail={currentEmail} />
    </div>
  );
}

function EmailForm({
  currentEmail,
  pendingEmail,
  onChanged,
}: {
  currentEmail: string;
  pendingEmail: string | null;
  onChanged: (email: string, pending: boolean) => void;
}) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = email.trim().toLowerCase();
  const canSubmit = !saving && EMAIL_RE.test(next) && next !== currentEmail.toLowerCase();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/chat` },
      );
      if (error) throw error;

      // With email confirmation off, the change applies immediately
      if (data.user?.email?.toLowerCase() === next) {
        onChanged(next, false);
        toast.success("Email address updated");
      } else {
        onChanged(next, true);
        toast.success("Check your inbox to confirm the change");
      }
      setEmail("");
    } catch (err) {
      setError(errorMessage(err, "Could not update email"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Email address</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          You sign in with <span className="font-medium text-foreground">{currentEmail}</span>.
        </p>
      </div>

      {pendingEmail ? (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
          Waiting for you to confirm{" "}
          <span className="font-medium text-foreground">{pendingEmail}</span>. Open the link we
          emailed to finish the change. Depending on your settings, your current address may
          need to confirm it too.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="new-email">New email</Label>
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={!canSubmit}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Change email
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ currentEmail }: { currentEmail: string }) {
  const supabase = createClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError =
    newPassword && newPassword.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : confirmPassword && newPassword !== confirmPassword
        ? "Passwords don't match."
        : newPassword && newPassword === currentPassword
          ? "Choose a password you aren't already using."
          : null;

  const canSubmit =
    !saving && !!currentPassword && !!newPassword && !!confirmPassword && !validationError;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      // Re-check the current password so an unattended session can't change it
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (verifyError) {
        setError("Your current password is incorrect.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (err) {
      setError(errorMessage(err, "Could not change password"));
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      toast.success(`Password reset link sent to ${currentEmail}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not send reset email"));
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Password</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Enter your current password to choose a new one.
        </p>
      </div>

      {/* Lets password managers associate the new password with this account */}
      <input type="email" autoComplete="username" value={currentEmail} readOnly hidden />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="current-password">Current password</Label>
          <button
            type="button"
            onClick={() => void sendReset()}
            disabled={sendingReset}
            className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
          >
            {sendingReset ? "Sending…" : "Forgot it?"}
          </button>
        </div>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {validationError || error ? (
        <p className="text-sm text-destructive">{validationError ?? error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={!canSubmit}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Change password
        </Button>
      </div>
    </form>
  );
}
