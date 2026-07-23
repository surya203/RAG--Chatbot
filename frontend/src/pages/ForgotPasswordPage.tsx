import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
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
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (data) => {
      setMessage(data.message);
      setSubmitted(true);
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
    setSubmitted(false);
    mutation.mutate(email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
            {submitted && !devToken ? (
              <Mail className="h-6 w-6 text-[var(--color-primary)]" />
            ) : (
              <KeyRound className="h-6 w-6 text-[var(--color-primary)]" />
            )}
          </div>
          <CardTitle>
            {submitted && !devToken ? "Check your email" : "Forgot your password?"}
          </CardTitle>
          <CardDescription>
            {submitted && !devToken
              ? "If an account exists for that address, we sent a reset link."
              : "Enter your email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted && !devToken ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />
                <p>{message}</p>
                <p className="mt-2 text-xs text-green-700/80">
                  Look for an email from Exam Coach with a <strong>Reset password</strong>{" "}
                  button (not an OTP code). It expires in 30 minutes — check Spam / Promotions
                  if you do not see it.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
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
              {message && devToken && (
                <p className="text-sm text-[var(--color-muted-foreground)]">{message}</p>
              )}
              {devToken && (
                <div className="rounded-md border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-3 text-sm">
                  <p className="mb-2 font-medium">Dev mode: SMTP not configured</p>
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
          )}
          {!submitted || devToken ? (
            <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
              Remembered it?{" "}
              <Link to="/login" className="font-medium text-[var(--color-primary)] hover:underline">
                Back to sign in
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
