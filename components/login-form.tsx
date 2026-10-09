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

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/chat");
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
          <CardTitle className="text-xl font-semibold tracking-tight">Welcome back</CardTitle>
          <CardDescription className="text-xs">
            Sign in to your Pager workspace to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="h-8 text-xs bg-background/50 border-border/70"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-[11px] text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  className="h-8 text-xs bg-background/50 border-border/70"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
              <Button type="submit" className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium" disabled={isLoading}>
                {isLoading ? "Signing in…" : "Sign In"}
              </Button>
            </div>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
