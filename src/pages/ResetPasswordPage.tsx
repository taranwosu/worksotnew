import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Check } from "lucide-react";
import { apiConfirmPasswordReset } from "@/lib/api";
import { usePageMeta } from "@/lib/seo";
import { AuthShell } from "@/components/AuthShell";
import {
  Button,
  FieldInput,
  FieldLabel,
  Tag,
} from "@/components/primitives";

export function ResetPasswordPage() {
  usePageMeta({
    title: "Choose a new password",
    description: "Set a new password for your WorkSoy account.",
    path: "/reset-password",
    robots: "noindex,nofollow",
  });
  const navigate = useNavigate();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing or invalid reset token. Request a new link.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await apiConfirmPasswordReset(token, password);
      setDone(true);
      setTimeout(() => navigate({ to: "/signin" }), 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reset password. The link may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      step="§ 02"
      kicker="New password"
      display={
        <>
          Pick something
          <br />
          you&rsquo;ll remember.
        </>
      }
      lede="Choose a new password for your WorkSoy account. We'll sign you out everywhere else as a precaution."
    >
      <div className="mx-auto w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <Tag tone="ink">Reset</Tag>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
            Step 2 of 2
          </span>
        </div>
        <h1 className="display-md text-ink">Choose a new password.</h1>

        {done ? (
          <div className="mt-10 flex flex-col gap-4 rounded border border-ink-12 bg-white p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sun">
              <Check className="h-5 w-5 text-ink" strokeWidth={2.5} />
            </div>
            <h2 className="font-display text-xl font-medium text-ink">
              Password updated.
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-60">
              Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <FieldInput
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
              <FieldInput
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
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
              disabled={loading || !token}
              className="w-full justify-between"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                "Save new password"
              )}
            </Button>
          </form>
        )}

        <p className="mt-8 text-[12.5px] text-ink-60">
          Need a fresh link?{" "}
          <Link to="/forgot-password" className="link-sweep text-ink">
            Request another
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
