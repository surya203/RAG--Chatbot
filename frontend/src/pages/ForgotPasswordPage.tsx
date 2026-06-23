import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

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
import { getApiErrorMessage } from "@/lib/api";
import { forgotPassword } from "@/services/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (data) => {
      setMessage(data.message);
      // Dev-only: email delivery isn't wired up, so the API returns the
      // reset token directly and we link straight to the reset form.
      setDevToken(data.reset_token ?? null);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Something went wrong. Please try again."));
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDevToken(null);
    mutation.mutate(email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
            <KeyRound className="h-6 w-6 text-[var(--color-primary)]" />
          </div>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>
            Enter your email and we'll help you reset it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="student@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            )}
            {message && (
              <p className="text-sm text-[var(--color-muted-foreground)]">{message}</p>
            )}
            {devToken && (
              <div className="rounded-md border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-3 text-sm">
                <p className="mb-2 font-medium">Dev mode: continue to reset</p>
                <Link
                  to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  Reset your password →
                </Link>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
            Remembered it?{" "}
            <Link to="/login" className="font-medium text-[var(--color-primary)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
