import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  AUTH_CONFIG,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/auth-client";
import { AuthShell } from "@/components/AuthShell";
import {
  Button,
  FieldInput,
  FieldLabel,
  Tag,
} from "@/components/primitives";

export function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const result = await signInWithEmail(email, password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? "Sign in failed");
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell
      step="§ 01"
      kicker="Return to the desk"
      display={
        <>
          Back to
          <br />
          your briefs.
        </>
      }
      lede="Pick up where you left off — active engagements, shortlists in review, and the inbox with your matcher."
      quote={{
        text:
          "The dashboard is where I actually run procurement. Everything is one click from an SOW.",
        author: "Elena Marsh",
        role: "Head of Ops, Hearth",
      }}
    >
      <div>
        <div className="flex items-center justify-between">
          <Tag tone="outline" size="sm">Sign in</Tag>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
            Members · 2026
          </p>
        </div>

        <h2 className="mt-6 font-display text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
          Welcome back.
        </h2>
        <p className="mt-2 text-[14px] text-ink-60">
          New here?{" "}
          <Link to="/signup" className="link-sweep font-semibold text-ink">
            Create an account
          </Link>
          .
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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

          <div>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <button
                type="button"
                className="text-[12px] text-ink-60 hover:text-ink"
              >
                Forgot?
              </button>
            </div>
            <FieldInput
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
            />
          </div>

          <Button
            tone="ink"
            size="lg"
            type="submit"
            disabled={isLoading}
            className="w-full"
            iconLeft={
              isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null
            }
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {AUTH_CONFIG.googleEnabled ? (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-12" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                Or
              </span>
              <div className="h-px flex-1 bg-ink-12" />
            </div>
            <Button
              tone="cream"
              size="lg"
              type="button"
              className="w-full"
              onClick={() => {
                void signInWithGoogle();
              }}
            >
              Continue with Google
            </Button>
          </>
        ) : null}

        <p className="mt-8 text-[11.5px] leading-relaxed text-ink-60">
          By signing in you agree to our{" "}
          <Link to="/contact" className="link-sweep text-ink">
            Terms
          </Link>{" "}
          &amp;{" "}
          <Link to="/contact" className="link-sweep text-ink">
            Privacy
          </Link>
          . WorkSoy never sells member data.
        </p>
      </div>
    </AuthShell>
  );
}
