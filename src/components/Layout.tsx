import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  X,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession, signOutUser } from "@/lib/auth-client";
import { Container, LinkButton, Logotype, Tag } from "@/components/primitives";
import { NotificationsBell } from "@/components/NotificationsBell";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [elevated, setElevated] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { data: session, isPending } = useSession();

  const hasExpertProfile = session?.user?.role === "expert";
  const unreadCount = 0;

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [routerState.location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    setProfileOpen(false);
    navigate({ to: "/" });
  };

  const navLinks = [
    { to: "/experts", label: "Network", index: "01" },
    { to: "/how-it-works", label: "How we work", index: "02" },
    { to: "/pricing", label: "Pricing", index: "03" },
    { to: "/for-experts", label: "For experts", index: "04" },
  ];

  const userName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const userImage = session?.user?.image;

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-ink-10 bg-cream/85 backdrop-blur-md transition-[border,background] duration-[var(--dur-base)]",
          elevated && "border-ink-12 bg-cream/95",
        )}
      >
        <Container className="flex h-[72px] items-center justify-between">
          <Link to="/" className="group relative z-10 flex items-center">
            <Logotype />
          </Link>

          <nav className="hidden items-center md:flex">
            <ol className="flex items-center gap-1">
              {navLinks.map((link) => {
                const active = routerState.location.pathname.startsWith(link.to);
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                        active ? "text-ink" : "text-ink-60 hover:text-ink",
                      )}
                    >
                      <span className="font-mono text-[10px] tracking-[0.1em] text-ink-40 group-hover:text-ink-60">
                        {link.index}
                      </span>
                      <span className="font-medium">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {isPending ? (
              <div className="h-9 w-28 animate-pulse rounded bg-ink-08" />
            ) : session ? (
              <>
                <Link
                  to="/messages"
                  className="relative flex h-9 w-9 items-center justify-center rounded text-ink-60 transition-colors hover:bg-ink-08 hover:text-ink"
                  aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                >
                  <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-sun px-1 text-[10px] font-semibold leading-none text-ink">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>

                <LinkButton
                  to={hasExpertProfile ? "/experts" : "/post-request"}
                  tone="ink"
                  size="sm"
                >
                  {hasExpertProfile ? "Browse projects" : "Post a brief"}
                </LinkButton>

                <NotificationsBell />

                <div className="relative ml-1" ref={profileRef}>
                  <button
                    data-testid="user-menu-trigger"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 rounded-pill border border-ink-12 bg-white p-1 pr-3 text-[13px] transition-colors hover:border-ink"
                  >
                    {userImage ? (
                      <img
                        src={userImage}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-cream">
                        {userInitial}
                      </span>
                    )}
                    <span className="font-medium text-ink">{userName.split(" ")[0]}</span>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded border border-ink-12 bg-white shadow-[0_24px_48px_-20px_rgba(26,26,26,0.25)]">
                      <div className="flex items-center justify-between border-b border-ink-08 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {userName}
                          </p>
                          <p className="truncate text-[11px] text-ink-60">
                            {session.user?.email}
                          </p>
                        </div>
                        {hasExpertProfile && <Tag tone="sun" size="sm">Expert</Tag>}
                      </div>
                      <div className="py-1 text-[13px]">
                        <MenuItem
                          to="/dashboard"
                          onClick={() => setProfileOpen(false)}
                          icon={<LayoutDashboard className="h-4 w-4" />}
                        >
                          Dashboard
                        </MenuItem>
                        <MenuItem
                          to="/messages"
                          onClick={() => setProfileOpen(false)}
                          icon={<MessageSquare className="h-4 w-4" />}
                          trailing={
                            unreadCount > 0 ? (
                              <Tag tone="ink" size="sm">
                                {unreadCount > 9 ? "9+" : unreadCount}
                              </Tag>
                            ) : null
                          }
                        >
                          Messages
                        </MenuItem>
                        {!hasExpertProfile && (
                          <MenuItem
                            to="/onboarding/expert"
                            onClick={() => setProfileOpen(false)}
                            icon={<UserIcon className="h-4 w-4" />}
                          >
                            Become an expert
                          </MenuItem>
                        )}
                        {amIAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Shield className="h-4 w-4 text-slate-400" />
                            Admin
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-ink-08">
                        <button
                          data-testid="user-menu-signout"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink hover:bg-cream-2"
                        >
                          <LogOut className="h-4 w-4" />
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
                  className="px-3 py-2 text-[13px] font-medium text-ink-60 transition-colors hover:text-ink"
                >
                  Sign in
                </Link>
                <LinkButton to="/signup" tone="ink" size="sm" arrow>
                  Post a brief
                </LinkButton>
              </>
            )}
          </div>

          <button
            aria-label="Toggle menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded p-2 text-ink hover:bg-ink-08 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </Container>

        {mobileOpen && (
          <div className="border-t border-ink-10 bg-cream md:hidden">
            <Container className="space-y-1 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded px-3 py-2 text-sm text-ink hover:bg-ink-08"
                >
                  <span className="font-mono text-[10px] tracking-[0.14em] text-ink-40">
                    {link.index}
                  </span>
                  <span className="font-medium">{link.label}</span>
                </Link>
              ))}

              <div className="my-3 border-t border-ink-10" />

              {isPending ? (
                <div className="h-10 animate-pulse rounded bg-ink-08" />
              ) : session ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    {userImage ? (
                      <img
                        src={userImage}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">
                        {userInitial}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {userName}
                      </p>
                      <p className="truncate text-[11px] text-ink-60">
                        {session.user?.email}
                      </p>
                    </div>
                  </div>
                  <MobileLink to="/dashboard" onClose={() => setMobileOpen(false)}>
                    Dashboard
                  </MobileLink>
                  <MobileLink to="/messages" onClose={() => setMobileOpen(false)}>
                    Messages{unreadCount > 0 ? ` · ${unreadCount}` : ""}
                  </MobileLink>
                  {hasExpertProfile ? (
                    <MobileLink to="/experts" onClose={() => setMobileOpen(false)}>
                      Browse projects
                    </MobileLink>
                  ) : (
                    <>
                      <MobileLink
                        to="/post-request"
                        onClose={() => setMobileOpen(false)}
                      >
                        Post a brief
                      </MobileLink>
                      <MobileLink
                        to="/onboarding/expert"
                        onClose={() => setMobileOpen(false)}
                      >
                        Become an expert
                      </MobileLink>
                    </>
                  )}
                  {amIAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="block w-full rounded px-3 py-2 text-left text-sm font-medium text-ink hover:bg-ink-08"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <MobileLink to="/signin" onClose={() => setMobileOpen(false)}>
                    Sign in
                  </MobileLink>
                  <LinkButton
                    to="/signup"
                    tone="ink"
                    size="md"
                    arrow
                    className="mt-2 w-full"
                  >
                    Post a brief
                  </LinkButton>
                </>
              )}
            </Container>
          </div>
        )}
      </header>

      <main>{children}</main>

      <Footer />
    </div>
  );
}

function MenuItem({
  to,
  onClick,
  icon,
  trailing,
  children,
}: {
  to: string;
  onClick: () => void;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-ink hover:bg-cream-2"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-ink-60">{icon}</span>
        {children}
      </span>
      {trailing}
    </Link>
  );
}

function MobileLink({
  to,
  onClose,
  children,
}: {
  to: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className="block rounded px-3 py-2 text-sm font-medium text-ink hover:bg-ink-08"
    >
      {children}
    </Link>
  );
}

function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-ink-12 bg-ink text-cream">
      <div className="grain pointer-events-none absolute inset-0" />
      <Container className="relative pb-10 pt-20">
        {/* Oversized wordmark */}
        <div className="mb-12 flex flex-col gap-4 border-b border-cream/10 pb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow text-cream/60">§ Colophon</div>
            <h2 className="mt-3 font-display text-[clamp(3.5rem,10vw,9rem)] font-medium leading-[0.88] tracking-[-0.04em]">
              worksoy<span className="text-sun">.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-cream/70">
            A premium network for senior contractors and fractional leaders.
            Briefed Monday, matched Wednesday, working Friday.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 md:grid-cols-12">
          <FooterCol
            className="md:col-span-3"
            title="For clients"
            links={[
              { label: "Browse the network", to: "/experts" },
              { label: "How we work", to: "/how-it-works" },
              { label: "Pricing", to: "/pricing" },
              { label: "Post a brief", to: "/post-request" },
            ]}
          />
          <FooterCol
            className="md:col-span-3"
            title="For experts"
            links={[
              { label: "Join the network", to: "/for-experts" },
              { label: "Apply to practice", to: "/onboarding/expert" },
              { label: "Rate benchmarks", to: "/pricing" },
              { label: "Field notes", to: "/how-it-works" },
            ]}
          />
          <FooterCol
            className="md:col-span-3"
            title="Office"
            links={[
              { label: "Contact", to: "/contact" },
              { label: "Partnerships", to: "/contact" },
              { label: "Press kit", to: "/contact" },
              { label: "Careers", to: "/contact" },
            ]}
          />
          <div className="md:col-span-3">
            <h4 className="eyebrow mb-4 text-cream/60">Dispatch</h4>
            <p className="text-sm leading-relaxed text-cream/70">
              Monthly rate benchmarks, hiring dispatches, and expert spotlights.
              No decks, no fluff.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-4 flex items-center overflow-hidden rounded border border-cream/15 bg-cream/5 focus-within:border-sun"
            >
              <input
                type="email"
                placeholder="you@company.com"
                className="h-11 flex-1 bg-transparent px-3.5 text-sm text-cream placeholder:text-cream/40 focus:outline-none"
              />
              <button
                type="submit"
                className="h-11 shrink-0 bg-sun px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[#FFB51F]"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-cream/10 pt-6 text-[12px] text-cream/50 md:flex-row md:items-center md:justify-between">
          <p className="font-mono uppercase tracking-[0.14em]">
            © {new Date().getFullYear()} WorkSoy Networks, Inc.
          </p>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <li>
              <Link to="/contact" className="hover:text-cream">
                Terms
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-cream">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-cream">
                Security
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-cream">
                Cookies
              </Link>
            </li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({
  title,
  links,
  className,
}: {
  title: string;
  links: { label: string; to: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h4 className="eyebrow mb-4 text-cream/60">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="link-sweep text-sm text-cream/90 hover:text-cream"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
