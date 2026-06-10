import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { apiResetPassword } from "@/lib/api";
import { AuthShell } from "@/components/AuthShell";
import { Button, FieldInput, FieldLabel, Tag } from "@/components/primitives";
import { toast } from "sonner";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!token) {
      setError("Missing reset token — open the link from your reset email.");
      return;
    }
    setSubmitting(true);
    try {
      await apiResetPassword(token, password);
      toast.success("Password updated — sign in with your new password.");
      navigate({ to: "/signin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      step="§ 01·R"
      kicker="Set a new passphrase"
      display={
        <>
          Choose a
          <br />
          <span className="italic">new</span> passphrase.
        </>
      }
      lede="Eight characters minimum. You'll be signed out of all other devices once this saves."
    >
      <div>
        <div className="flex items-center justify-between">
          <Tag tone="outline" size="sm">Reset password</Tag>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
            One-time use
          </p>
        </div>

        <h2 className="mt-6 font-display text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
          Save your new password.
        </h2>

        {!token && (
          <div
            role="alert"
            className="mt-6 rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust"
          >
            Missing reset token. Open the link from the email or request a new one from{" "}
            <Link to="/forgot-password" className="font-semibold underline">/forgot-password</Link>.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust"
            data-testid="reset-error"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" data-testid="reset-form">
          <div>
            <FieldLabel htmlFor="new">New password</FieldLabel>
            <FieldInput
              id="new"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              data-testid="reset-new"
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
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              placeholder="••••••••"
              data-testid="reset-confirm"
            />
          </div>
          <Button
            tone="ink"
            size="lg"
            type="submit"
            disabled={submitting || !token}
            className="w-full"
            data-testid="reset-submit"
            iconLeft={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          >
            {submitting ? "Saving…" : "Save new password"}
          </Button>
        </form>

        <p className="mt-8 text-[11.5px] leading-relaxed text-ink-60">
          Changed your mind?{" "}
          <Link to="/signin" className="link-sweep font-semibold text-ink">
            Back to sign in
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
