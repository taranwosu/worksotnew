import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Compass, Menu, X, LayoutDashboard, LogOut, User as UserIcon, Briefcase, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession, signOutUser } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { data: session, isPending } = useSession();

  const expertProfiles = useQuery(
    api.queries.listExpertProfiles,
    session ? {} : "skip"
  );
  const hasExpertProfile = (expertProfiles?.length ?? 0) > 0;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [routerState.location.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const handleSignOut = async () => {
    await signOutUser();
    setProfileOpen(false);
    navigate({ to: "/" });
  };

  const navLinks = [
    { to: "/experts", label: "Find Experts" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "/pricing", label: "Pricing" },
    { to: "/for-experts", label: "For Experts" },
  ];

  const userName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const userImage = session?.user?.image;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 shadow-sm transition-transform group-hover:scale-105">
              <Compass className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-tight text-slate-900">WorkSoy</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Expert Network</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 [&.active]:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isPending ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100" />
            ) : session ? (
              <>
                {hasExpertProfile ? (
                  <Link
                    to="/experts"
                    className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Search className="h-4 w-4" />
                    Browse projects
                  </Link>
                ) : (
                  <Link
                    to="/post-request"
                    className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Briefcase className="h-4 w-4" />
                    Post a project
                  </Link>
                )}

                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-slate-100"
                  >
                    {userImage ? (
                      <img
                        src={userImage}
                        alt={userName}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-semibold text-white">
                        {userInitial}
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-700">{userName}</span>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                        <p className="truncate text-xs text-slate-500">{session.user?.email}</p>
                        {hasExpertProfile && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                            Expert
                          </span>
                        )}
                      </div>
                      <div className="py-1">
                        <Link
                          to="/dashboard"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <LayoutDashboard className="h-4 w-4 text-slate-400" />
                          Dashboard
                        </Link>
                        {!hasExpertProfile && (
                          <Link
to="/onboarding/expert"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <UserIcon className="h-4 w-4 text-slate-400" />
                            Become an expert
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-slate-100 py-1">
                        <button
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <LogOut className="h-4 w-4 text-slate-400" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          <button
            aria-label="Toggle menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="mx-auto max-w-7xl space-y-1 px-4 py-3">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-2 border-t border-slate-200" />

              {isPending ? (
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ) : session ? (
                <>
                  <div className="flex items-center gap-3 rounded-md px-3 py-2">
                    {userImage ? (
                      <img src={userImage} alt={userName} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-semibold text-white">
                        {userInitial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                      <p className="truncate text-xs text-slate-500">{session.user?.email}</p>
                    </div>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Dashboard
                  </Link>
                  {hasExpertProfile ? (
                    <Link
                      to="/experts"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Browse projects
                    </Link>
                  ) : (
                    <>
                      <Link
                        to="/post-request"
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Post a project
                      </Link>
                      <Link
                        to="/onboarding/expert"
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Become an expert
                      </Link>
                    </>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/signin"
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 block rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="mt-24 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-950">
                  <Compass className="h-5 w-5 text-white" strokeWidth={2.25} />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-base font-semibold tracking-tight text-slate-900">WorkSoy</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Expert Network</span>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
                The professional network where companies find vetted, senior-level experts for project-based work.
              </p>
            </div>
            <FooterCol title="For Clients" links={[
              { label: "Browse experts", to: "/experts" },
              { label: "How it works", to: "/how-it-works" },
              { label: "Pricing", to: "/pricing" },
            ]} />
            <FooterCol title="For Experts" links={[
              { label: "Join network", to: "/for-experts" },
              { label: "Success stories", to: "/for-experts" },
              { label: "Resources", to: "/how-it-works" },
            ]} />
            <FooterCol title="Company" links={[
              { label: "Contact", to: "/contact" },
              { label: "About", to: "/how-it-works" },
              { label: "Terms", to: "/contact" },
            ]} />
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 text-xs text-slate-500 md:flex-row">
            <p>&copy; {new Date().getFullYear()} WorkSoy Expert Network. All rights reserved.</p>
            <p>Connect with experts. Work without limits.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">{title}</h4>
      <ul className="mt-4 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-sm text-slate-600 transition-colors hover:text-slate-900">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
