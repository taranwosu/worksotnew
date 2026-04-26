import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { apiLogin } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { Container, Button, FieldInput, FieldLabel, Tag } from "@/components/primitives";
import { usePageMeta } from "@/lib/seo";

export function AdminLoginPage() {
  usePageMeta({
    title: "Admin sign in",
    path: "/admin/login",
    robots: "noindex,nofollow",
  });
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("admin@worksoy.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await apiLogin(email, password);
      if (user.role !== "admin") {
        setError("This account doesn't have admin access");
        return;
      }
      setUser(user);
      navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-ink text-cream">
      <Container className="flex min-h-[80vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-xl border border-cream/15 bg-ink-2 p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sun" />
            <Tag tone="sun" size="sm">Admin console</Tag>
          </div>
          <h1 className="mt-5 font-display text-[28px] font-medium tracking-[-0.02em]">
            Sign in to the back office.
          </h1>
          <p className="mt-2 text-[13px] text-cream/60">
            Restricted to WorkSoy operators. All activity is logged.
          </p>

          {error && (
            <div role="alert" className="mt-6 rounded border border-rust/40 bg-rust/10 px-3 py-2 text-[13px] text-rust">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <FieldLabel htmlFor="email" className="text-cream/70">Email</FieldLabel>
              <FieldInput
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-cream/20 bg-ink-3 text-cream placeholder:text-cream/40"
              />
            </div>
            <div>
              <FieldLabel htmlFor="password" className="text-cream/70">Password</FieldLabel>
              <FieldInput
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-cream/20 bg-ink-3 text-cream placeholder:text-cream/40"
              />
            </div>
            <Button
              data-testid="admin-login-submit"
              tone="sun"
              size="lg"
              type="submit"
              disabled={loading}
              className="w-full"
              iconLeft={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </Container>
    </div>
  );
}
