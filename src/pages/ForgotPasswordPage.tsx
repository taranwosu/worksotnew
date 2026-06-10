import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Copy, Check } from "lucide-react";
import { apiForgotPassword } from "@/lib/api";
import { AuthShell } from "@/components/AuthShell";
import { Button, FieldInput, FieldLabel, Tag } from "@/components/primitives";
import { toast } from "sonner";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await apiForgotPassword(email);
      setDevLink(r.dev_link);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start password reset");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!devLink) return;
    try {
      await navigator.clipboard.writeText(devLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link to clipboard");
    }
  };

  return (
    <AuthShell
      step="§ 01·R"
      kicker="Reset access"
      display={
        <>
          Lost the
          <br />
          <span className="italic">passphrase</span>?
        </>
      }
      lede="Drop your work email. We'll cut a single-use reset link that's valid for one hour. No marketing, no follow-ups."
    >
      <div>
        <div className="flex items-center justify-between">
          <Tag tone="outline" size="sm">Forgot password</Tag>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
            One-hour expiry
          </p>
        </div>

        <h2 className="mt-6 font-display text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
          Send me a reset link.
        </h2>
        <p className="mt-2 text-[14px] text-ink-60">
          Remembered it?{" "}
          <Link to="/signin" className="link-sweep font-semibold text-ink">
            Back to sign in
          </Link>
          .
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4" data-testid="forgot-form">
            <div>
              <FieldLabel htmlFor="email">Work email</FieldLabel>
              <FieldInput
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                data-testid="forgot-email"
              />
            </div>
            <Button
              tone="ink"
              size="lg"
              type="submit"
              disabled={submitting}
              className="w-full"
              data-testid="forgot-submit"
              iconLeft={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            >
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        ) : (
          <div className="mt-8 space-y-4" data-testid="forgot-success">
            <div className="rounded border border-ink-12 bg-cream-2/60 p-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                Sent
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">
                If <strong>{email}</strong> is on the roster, a reset link is on its way. It expires in one hour and works exactly once.
              </p>
            </div>

            {devLink && (
              <div className="rounded border border-sun/40 bg-sun/10 p-5" data-testid="forgot-dev-link">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink">
                  Dev / staging link
                </p>
                <p className="mt-1 text-[12.5px] text-ink-60">
                  Email isn't wired yet — copy this link to continue.
                </p>
                <div className="mt-3 flex items-stretch gap-2">
                  <code className="min-w-0 flex-1 truncate rounded border border-ink-20 bg-white px-3 py-2 font-mono text-[12px] text-ink">
                    {devLink}
                  </code>
                  <Button
                    tone="outline"
                    size="md"
                    type="button"
                    onClick={copyLink}
                    data-testid="forgot-copy-link"
                    iconLeft={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}

            <Link
              to="/signin"
              className="inline-block text-[13px] font-semibold text-ink underline"
            >
              ← Back to sign in
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
