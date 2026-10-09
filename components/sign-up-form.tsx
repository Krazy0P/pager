"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
          data: {
            display_name: displayName.trim(),
            username: username.trim().toLowerCase(),
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        router.push("/chat");
      } else {
        router.push("/auth/sign-up-success");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border/80 bg-card/80 backdrop-blur-xs">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded bg-primary text-primary-foreground font-semibold">
            P
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">Create your account</CardTitle>
          <CardDescription className="text-xs">Join Pager for instant team communications</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="display-name" className="text-xs font-medium">Display name</Label>
                  <Input
                    id="display-name"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="h-8 text-xs bg-background/50 border-border/70"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="username" className="text-xs font-medium">Username</Label>
                  <Input
                    id="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ada"
                    className="h-8 text-xs bg-background/50 border-border/70 font-mono"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs bg-background/50 border-border/70"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-8 text-xs bg-background/50 border-border/70"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="repeat-password" className="text-xs font-medium">Repeat Password</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="h-8 text-xs bg-background/50 border-border/70"
                />
              </div>
              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
              <Button type="submit" className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium mt-1" disabled={isLoading}>
                {isLoading ? "Creating account…" : "Create Account"}
              </Button>
            </div>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
