import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Check } from "lucide-react";
import { apiRequestPasswordReset } from "@/lib/api";
import { usePageMeta } from "@/lib/seo";
import { AuthShell } from "@/components/AuthShell";
import {
  Button,
  FieldInput,
  FieldLabel,
  Tag,
} from "@/components/primitives";

export function ForgotPasswordPage() {
  usePageMeta({
    title: "Reset your password",
    description: "Request a password reset link for your WorkSoy account.",
    path: "/forgot-password",
    robots: "noindex,nofollow",
  });
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await apiRequestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      step="§ 02"
      kicker="Forgot password"
      display={
        <>
          A reset link,
          <br />
          on its way.
        </>
      }
      lede="Tell us the email on your WorkSoy account and we'll send a one-time link. Links expire after one hour."
    >
      <div className="mx-auto w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <Tag tone="ink">Reset</Tag>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
            Step 1 of 2
          </span>
        </div>
        <h1 className="display-md text-ink">Reset your password.</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-60">
          We&rsquo;ll only send a link if the email matches an account.
        </p>

        {submitted ? (
          <div className="mt-10 flex flex-col gap-4 rounded border border-ink-12 bg-white p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sun">
              <Check className="h-5 w-5 text-ink" strokeWidth={2.5} />
            </div>
            <h2 className="font-display text-xl font-medium text-ink">
              Check your inbox.
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-60">
              If <span className="font-mono">{email}</span> matches an account,
              you&rsquo;ll receive a reset link in the next minute. The link
              expires in one hour.
            </p>
            <p className="text-[12.5px] text-ink-40">
              Didn&rsquo;t receive it? Check spam, or{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setSubmitted(false)}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div>
              <FieldLabel htmlFor="email">Work email</FieldLabel>
              <FieldInput
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@company.com"
              />
            </div>
            {error ? (
              <p className="text-[13px] text-rust" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              tone="ink"
              size="lg"
              type="submit"
              arrow
              disabled={loading}
              className="w-full justify-between"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        )}

        <p className="mt-8 text-[12.5px] text-ink-60">
          Remembered it?{" "}
          <Link to="/signin" className="link-sweep text-ink">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
