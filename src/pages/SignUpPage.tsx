import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Compass, Mail, Lock, User, Loader2, Briefcase, UserCheck } from "lucide-react";
import {
  AUTH_CONFIG,
  signUpWithEmail,
  signInWithGoogle,
} from "@/lib/auth-client";

type Role = "client" | "expert";

export function SignUpPage() {
  const navigate = useNavigate();
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
    const result = await signUpWithEmail(email, password, name);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? "Sign up failed");
      return;
    }
    // Experts go to onboarding, clients to dashboard
    if (role === "expert") {
      navigate({ to: "/onboarding/expert" });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 shadow-sm">
              <Compass className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-semibold tracking-tight text-slate-900">WorkSoy</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Expert Network</span>
            </div>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
            <p className="mt-1 text-sm text-slate-600">Join the premium expert network</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("client")}
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 text-center transition-all ${
                role === "client"
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <Briefcase className="h-5 w-5 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">I'm hiring</span>
              <span className="text-xs text-slate-500">Find an expert</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("expert")}
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 text-center transition-all ${
                role === "expert"
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <UserCheck className="h-5 w-5 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">I'm an expert</span>
              <span className="text-xs text-slate-500">Find work</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null); }}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Jane Smith"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="At least 8 characters"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Creating account..." : "Create account"}
            </button>
          </form>

          {AUTH_CONFIG.googleEnabled ? (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                onClick={() => { void signInWithGoogle(); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-50"
              >
                Continue with Google
              </button>
            </>
          ) : null}

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold text-slate-900 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
