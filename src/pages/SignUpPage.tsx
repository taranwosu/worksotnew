import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Briefcase, UserCheck } from "lucide-react";
import {
  AUTH_CONFIG,
  signInWithGoogle,
  useAuth,
} from "@/lib/auth-client";
import { apiRegister } from "@/lib/api";
import { AuthShell } from "@/components/AuthShell";
import {
  Button,
  FieldInput,
  FieldLabel,
  Tag,
} from "@/components/primitives";
import { cn } from "@/lib/utils";

type Role = "client" | "expert";

export function SignUpPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [role, setRole] = useState<Role>("client");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { user } = await apiRegister(email, password, name);
      setUser(user);
      if (role === "expert") {
        navigate({ to: "/onboarding/expert" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      step="§ 01"
      kicker={role === "expert" ? "Roster application" : "Open a client account"}
      display={
        role === "expert" ? (
          <>
            Join the
            <br />
            <span className="italic">roster</span>.
          </>
        ) : (
          <>
            Hire the
            <br />
            right <span className="italic">hands</span>.
          </>
        )
      }
      lede={
        role === "expert"
          ? "Pre-qualified briefs, escrow-backed payouts, and counter-signed SOWs — so you can focus on the work, not the sell."
          : "Brief us in ten minutes. Meet three hand-matched finalists inside 48 hours and sign the SOW by Friday."
      }
      quote={{
        text:
          role === "expert"
            ? "I replaced three months of outbound with one form. Briefs match what I&rsquo;d have picked out of a pile anyway."
            : "Three shortlists, a working-session with the finalist, and a signed SOW by Friday.",
        author: role === "expert" ? "Marcus Thompson" : "Priya Raman",
        role:
          role === "expert"
            ? "Operations consultant · On roster since 2024"
            : "COO, Northwind Labs",
      }}
    >
      <div>
        <div className="flex items-center justify-between">
          <Tag tone="outline" size="sm">Create account</Tag>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
            Takes ~2 min
          </p>
        </div>

        <h2 className="mt-6 font-display text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
          Tell us which desk you&rsquo;re on.
        </h2>
        <p className="mt-2 text-[14px] text-ink-60">
          Already a member?{" "}
          <Link to="/signin" className="link-sweep font-semibold text-ink">
            Sign in
          </Link>
          .
        </p>

        <div
          role="radiogroup"
          aria-label="Account type"
          className="mt-6 grid grid-cols-2 gap-3"
        >
          <RoleCard
            active={role === "client"}
            onClick={() => setRole("client")}
            icon={<Briefcase className="h-5 w-5" strokeWidth={1.75} />}
            title="Hiring"
            sub="Brief a contractor"
          />
          <RoleCard
            active={role === "expert"}
            onClick={() => setRole("expert")}
            icon={<UserCheck className="h-5 w-5" strokeWidth={1.75} />}
            title="On the roster"
            sub="Apply to the network"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <FieldInput
              id="name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Jane Smith"
            />
          </div>
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
            <FieldLabel htmlFor="password">Password</FieldLabel>
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

          <Button
            data-testid="signup-submit"
            tone="ink"
            size="lg"
            type="submit"
            disabled={isLoading}
            className="w-full"
            iconLeft={
              isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null
            }
            arrow={!isLoading}
          >
            {isLoading
              ? "Creating account…"
              : role === "expert"
                ? "Start application"
                : "Create account"}
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
      </div>
    </AuthShell>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-3 rounded border p-4 text-left transition-all",
        active
          ? "border-ink bg-ink text-cream"
          : "border-ink-12 bg-white text-ink hover:border-ink",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded",
          active ? "bg-sun text-ink" : "bg-cream-2 text-ink",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="font-display text-[14px] font-semibold">{title}</p>
        <p
          className={cn(
            "mt-0.5 text-[12px]",
            active ? "text-cream/70" : "text-ink-60",
          )}
        >
          {sub}
        </p>
      </div>
    </button>
  );
}
