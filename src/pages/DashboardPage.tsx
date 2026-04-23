import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Briefcase,
  UserCheck,
  Plus,
  Loader2,
  Star,
  TrendingUp,
  CheckCircle2,
  FileText,
  DollarSign,
  Eye,
  MessageSquare,
  Calendar,
  Sparkles,
  ArrowRight,
  Target,
  Zap,
  Bell,
  Search,
  BarChart3,
  Clock,
  FolderKanban,
  CircleDollarSign,
  BadgeCheck,
  Award,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";
import { PortfolioSection } from "@/components/PortfolioSection";
import { LeaveReviewList, ReceivedReviewsList } from "@/components/ReviewsSection";
import { ContractsSection } from "@/components/ContractsSection";

export function DashboardPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const expertProfiles = useQuery(api.queries.listExpertProfiles, session ? {} : "skip");
  const clientRequests = useQuery(api.queries.listClientRequests, session ? {} : "skip");
  const proposals = useQuery(api.queries.listProposals, session ? {} : "skip");
  const engagements = useQuery(api.milestones.listMyEngagements, session ? {} : "skip");
  const myBadges = useQuery(api.verification.listMyBadges, session ? {} : "skip");

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    navigate({ to: "/signin" });
    return null;
  }

  const hasExpertProfile = expertProfiles && expertProfiles.length > 0;
  const expertProfile = hasExpertProfile ? expertProfiles[0] : null;
  const userName = session.user?.name ?? session.user?.email?.split("@")[0] ?? "there";
  const firstName = userName.split(" ")[0];

  // Stats calculations
  const activeProjects = clientRequests?.filter((r) => r.status === "open").length ?? 0;
  const totalProposalsReceived = clientRequests?.reduce((sum, r) => sum + (r.proposalCount || 0), 0) ?? 0;
  const pendingProposals = proposals?.filter((p) => p.status === "pending").length ?? 0;
  const acceptedProposals = proposals?.filter((p) => p.status === "accepted").length ?? 0;

  // Profile completeness for experts
  const profileCompleteness = expertProfile
    ? calculateCompleteness(expertProfile)
    : 0;

  // Current hour for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Loading states
  const isLoadingData = !expertProfiles || !clientRequests || !proposals;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Greeting Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500">{greeting}, {firstName} 👋</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {hasExpertProfile ? "Your expert workspace" : "Your dashboard"}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {hasExpertProfile
                  ? "Manage your profile, proposals, and active projects in one place."
                  : "Find world-class experts for your next project."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!hasExpertProfile && (
                <Link
                  to="/onboarding/expert"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Become an expert
                </Link>
              )}
              {hasExpertProfile ? (
                <Link
                  to="/experts"
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  <Search className="h-4 w-4" />
                  Find projects
                </Link>
              ) : (
                <Link
                  to="/post-request"
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  New project
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Profile completion banner (experts only, if incomplete) */}
        {hasExpertProfile && expertProfile && profileCompleteness < 100 && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Your profile is {profileCompleteness}% complete
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Complete profiles get up to 5× more project invites.
                  </p>
                  <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                      style={{ width: `${profileCompleteness}%` }}
                    />
                  </div>
                </div>
              </div>
              <Link
                to="/onboarding/expert"
                className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                Complete profile
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {hasExpertProfile && expertProfile ? (
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Star}
              label="Rating"
              value={expertProfile.rating > 0 ? expertProfile.rating.toFixed(1) : "New"}
              sublabel={`${expertProfile.reviewCount} reviews`}
              accent="amber"
              loading={isLoadingData}
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={String(expertProfile.completedProjects)}
              sublabel="projects delivered"
              accent="emerald"
              loading={isLoadingData}
            />
            <StatCard
              icon={FileText}
              label="Proposals"
              value={String(pendingProposals)}
              sublabel={`${acceptedProposals} accepted`}
              accent="blue"
              loading={isLoadingData}
            />
            <StatCard
              icon={DollarSign}
              label="Your rate"
              value={`$${expertProfile.hourlyRate}`}
              sublabel={`per hour · ${expertProfile.currency}`}
              accent="slate"
              loading={isLoadingData}
            />
          </div>
        ) : (
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Briefcase}
              label="Active projects"
              value={String(activeProjects)}
              sublabel={`${clientRequests?.length ?? 0} total posted`}
              accent="blue"
              loading={isLoadingData}
            />
            <StatCard
              icon={MessageSquare}
              label="Proposals received"
              value={String(totalProposalsReceived)}
              sublabel="from experts"
              accent="emerald"
              loading={isLoadingData}
            />
            <StatCard
              icon={Eye}
              label="Profile views"
              value="—"
              sublabel="coming soon"
              accent="slate"
              loading={false}
            />
            <StatCard
              icon={Calendar}
              label="Member since"
              value={new Date(session.user?.createdAt ?? Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              sublabel="WorkSoy"
              accent="amber"
              loading={false}
            />
          </div>
        )}

        {/* Expert Profile Card (if expert) */}
        {hasExpertProfile && expertProfile && (
          <div className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-sm">
            <div className="relative p-6 sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)]" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  {session.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={expertProfile.fullName}
                      className="h-16 w-16 rounded-full border-2 border-white/20 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
                      {expertProfile.fullName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {expertProfile.isPublished ? "Active & visible" : "Draft"}
                      </span>
                      {expertProfile.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <h2 className="flex items-center gap-1.5 text-xl font-bold text-white sm:text-2xl">
                      {expertProfile.fullName}
                      {expertProfile.isVerified && (
                        <BadgeCheck className="h-5 w-5 text-blue-400" />
                      )}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-300">{expertProfile.headline}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>📍 {expertProfile.location}</span>
                      <span>•</span>
                      <span>{expertProfile.yearsExperience} years exp</span>
                      <span>•</span>
                      <span>{expertProfile.availability}</span>
                    </div>
                    {myBadges && myBadges.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {myBadges.map((b) => (
                          <span
                            key={b._id}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
                          >
                            <Award className="h-3 w-3" />
                            {b.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {!expertProfile.isVerified && (
                    <Link
                      to="/verification"
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-400"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      Get verified
                    </Link>
                  )}
                  <Link
                    to="/experts"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                  >
                    <Eye className="h-4 w-4" />
                    View public profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Cards - only for non-experts */}
        {!hasExpertProfile && (
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ActionCard
              icon={UserCheck}
              title="Become an expert"
              description="Join thousands of professionals earning on their own terms."
              to="/onboarding/expert"
              cta="Set up profile"
              accent="amber"
            />
            <ActionCard
              icon={Target}
              title="Post a project"
              description="Describe your needs and get matched with top experts."
              to="/post-request"
              cta="Post now"
              accent="blue"
            />
            <ActionCard
              icon={Briefcase}
              title="Browse experts"
              description="Explore our network of senior-level professionals."
              to="/experts"
              cta="Browse"
              accent="slate"
            />
          </div>
        )}

        {/* Active engagements — accepted proposals for both roles */}
        {engagements && engagements.length > 0 && (
          <Section
            title="Active engagements"
            subtitle="Accepted proposals with milestone tracking"
            count={engagements.length}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {engagements.map((e) => (
                <EngagementCard key={e.proposalId} engagement={e} />
              ))}
            </div>
          </Section>
        )}

        {/* Contracts and pending reviews */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <ContractsSection />
          <LeaveReviewList />
        </div>

        {/* Two-column layout for content */}
        <div className="mt-10 grid gap-8 lg:grid-cols-5">
          {/* Main column */}
          <div className="space-y-8 lg:col-span-3">
            <Section
              title={hasExpertProfile ? "My proposals" : "My projects"}
              subtitle={hasExpertProfile ? "Proposals you've submitted" : "Projects you've posted"}
              count={(hasExpertProfile ? proposals?.length : clientRequests?.length) ?? 0}
              action={
                hasExpertProfile ? (
                  <Link to="/experts" className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Search className="h-3.5 w-3.5" />
                    Find projects
                  </Link>
                ) : (
                  <Link to="/post-request" className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </Link>
                )
              }
            >
              {hasExpertProfile ? (
                !proposals ? (
                  <SkeletonList />
                ) : proposals.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No proposals yet"
                    description="Browse open projects and submit your first proposal to start earning."
                    cta={{ label: "Find projects", to: "/experts" }}
                  />
                ) : (
                  <div className="space-y-3">
                    {proposals.map((p) => (
                      <ProposalCard key={p._id} proposal={p} />
                    ))}
                  </div>
                )
              ) : (
                !clientRequests ? (
                  <SkeletonList />
                ) : clientRequests.length === 0 ? (
                  <EmptyState
                    icon={Briefcase}
                    title="No projects posted yet"
                    description="Post your first project to get matched with world-class experts."
                    cta={{ label: "Post a project", to: "/post-request" }}
                  />
                ) : (
                  <div className="space-y-3">
                    {clientRequests.map((req) => (
                      <ProjectCard key={req._id} request={req} />
                    ))}
                  </div>
                )
              )}
            </Section>

            {/* Portfolio — experts only */}
            {hasExpertProfile && expertProfile && (
              <PortfolioSection expertProfileId={expertProfile._id} />
            )}

            {/* Reviews received */}
            {session.user && (
              <Section
                title="Reviews received"
                subtitle="What your counterparts have said"
                count={0}
                hideCount
              >
                <ReceivedReviewsList subjectUserId={session.user.id} />
              </Section>
            )}

            {/* Insights section */}
            {!isLoadingData && (
              <Section
                title="Insights"
                subtitle="Your performance at a glance"
                count={0}
                hideCount
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <InsightCard
                    icon={BarChart3}
                    title={hasExpertProfile ? "Response rate" : "Match rate"}
                    value={hasExpertProfile ? "—" : "—"}
                    description={hasExpertProfile ? "Proposals accepted vs submitted" : "Experts responding to your projects"}
                    accent="blue"
                  />
                  <InsightCard
                    icon={Clock}
                    title="Avg. response time"
                    value="—"
                    description="Track this as you engage more"
                    accent="emerald"
                  />
                </div>
              </Section>
            )}
          </div>

          {/* Sidebar column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Quick actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Zap className="h-4 w-4 text-amber-500" />
                Quick actions
              </h3>
              <div className="mt-4 space-y-1">
                {hasExpertProfile ? (
                  <>
                    <QuickAction to="/experts" icon={Target} label="Find new projects" />
                    <QuickAction to="/messages" icon={MessageSquare} label="Open messages" />
                    <QuickAction to="/onboarding/expert" icon={UserCheck} label="Edit my profile" />
                  </>
                ) : (
                  <>
                    <QuickAction to="/post-request" icon={Plus} label="Post a new project" />
                    <QuickAction to="/messages" icon={MessageSquare} label="Open messages" />
                    <QuickAction to="/experts" icon={Briefcase} label="Browse all experts" />
                    <QuickAction to="/onboarding/expert" icon={UserCheck} label="Become an expert" />
                  </>
                )}
              </div>
            </div>

            {/* Notifications / Tips */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Bell className="h-4 w-4 text-slate-400" />
                Notifications
              </h3>
              <div className="mt-4 space-y-3">
                <ActivityItem
                  icon={UserCheck}
                  text="Welcome to WorkSoy"
                  time="Just now"
                  color="emerald"
                />
                {clientRequests && clientRequests.length > 0 && (
                  <ActivityItem
                    icon={Briefcase}
                    text={`Posted "${clientRequests[0].title}"`}
                    time="Recently"
                    color="blue"
                  />
                )}
                {hasExpertProfile && (
                  <ActivityItem
                    icon={Star}
                    text="Expert profile created"
                    time="Recently"
                    color="amber"
                  />
                )}
                {proposals && proposals.length > 0 && (
                  <ActivityItem
                    icon={FileText}
                    text={`Submitted ${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`}
                    time="Recently"
                    color="blue"
                  />
                )}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Full notification center coming soon.
                </p>
              </div>
            </div>

            {/* Tips card */}
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {hasExpertProfile ? "Boost your profile" : "Pro tip"}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {hasExpertProfile
                  ? "Profiles with portfolio case studies get 3× more project invites. Add yours to stand out."
                  : "Be specific in your project brief — projects with clear requirements get matched 2× faster."}
              </p>
              <Link
                to={hasExpertProfile ? "/for-experts" : "/how-it-works"}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Learn more
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Helpers ===

function calculateCompleteness(profile: any): number {
  const checks = [
    Boolean(profile.fullName),
    Boolean(profile.headline),
    Boolean(profile.bio && profile.bio.length > 50),
    Boolean(profile.specialties && profile.specialties.length > 0),
    Boolean(profile.skills && profile.skills.length >= 3),
    Boolean(profile.hourlyRate > 0),
    Boolean(profile.location),
    Boolean(profile.yearsExperience > 0),
    Boolean(profile.certifications && profile.certifications.length > 0),
    Boolean(profile.isPublished),
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

// === Components ===

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
  loading,
}: {
  icon: any;
  label: string;
  value: string;
  sublabel: string;
  accent: "blue" | "emerald" | "amber" | "slate";
  loading?: boolean;
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accents[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
        ) : (
          <div className="text-2xl font-bold text-slate-900">{value}</div>
        )}
        <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  to,
  cta,
  accent,
}: {
  icon: any;
  title: string;
  description: string;
  to: string;
  cta: string;
  accent: "slate" | "blue" | "amber";
}) {
  const accents = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${accents[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-600">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:gap-1.5 group-hover:text-slate-700">
        {cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Section({
  title,
  subtitle,
  count,
  action,
  children,
  hideCount,
}: {
  title: string;
  subtitle?: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  hideCount?: boolean;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {title}
            {!hideCount && <span className="ml-1 text-sm font-normal text-slate-500">({count})</span>}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  description,
  accent,
}: {
  icon: any;
  title: string;
  value: string;
  description: string;
  accent: "blue" | "emerald";
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accents[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function ProjectCard({ request }: { request: any }) {
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              request.status === "open"
                ? "bg-emerald-50 text-emerald-700"
                : request.status === "in_progress"
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-600"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                request.status === "open" ? "bg-emerald-500"
                : request.status === "in_progress" ? "bg-blue-500"
                : "bg-slate-400"
              }`} />
              {request.status.replace("_", " ")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {request.category}
            </span>
            <span className="text-xs text-slate-500">{request.proposalCount} proposals</span>
          </div>
          <h3 className="mt-2 font-semibold text-slate-900">{request.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{request.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              ${request.budgetMin.toLocaleString()}–${request.budgetMax.toLocaleString()}
            </span>
            <span>•</span>
            <span>{request.durationWeeks} weeks</span>
            <span>•</span>
            <span>{request.remoteOk ? "Remote" : request.location}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EngagementCard({ engagement }: { engagement: any }) {
  const pct =
    engagement.totalAmount > 0
      ? Math.round((engagement.paidAmount / engagement.totalAmount) * 100)
      : 0;
  return (
    <Link
      to="/workspace/$proposalId"
      params={{ proposalId: engagement.proposalId }}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <FolderKanban className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {engagement.role}
            </span>
            <span className="text-xs text-slate-500">
              {engagement.milestoneCount} milestone{engagement.milestoneCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1.5 truncate font-semibold text-slate-900">
            {engagement.requestTitle}
          </p>
          {engagement.totalAmount > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-600">
                  <CircleDollarSign className="h-3 w-3" />
                  {formatMoney(engagement.paidAmount, engagement.currency)} of{" "}
                  {formatMoney(engagement.totalAmount, engagement.currency)}
                </span>
                <span className="font-semibold text-slate-900">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 group-hover:text-slate-900">
        Open workspace
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function ProposalCard({ proposal }: { proposal: any }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              proposal.status === "pending" ? "bg-amber-50 text-amber-700"
              : proposal.status === "accepted" ? "bg-emerald-50 text-emerald-700"
              : proposal.status === "rejected" ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-600"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                proposal.status === "pending" ? "bg-amber-500"
                : proposal.status === "accepted" ? "bg-emerald-500"
                : proposal.status === "rejected" ? "bg-rose-500"
                : "bg-slate-400"
              }`} />
              {proposal.status}
            </span>
            <span className="text-xs font-semibold text-slate-700">
              ${proposal.proposedRate}/{proposal.rateType}
            </span>
          </div>
          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{proposal.coverLetter}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{proposal.estimatedDurationWeeks} weeks</span>
            <span>•</span>
            <span>{proposal.availability}</span>
          </div>
          <div className="mt-3">
            <Link
              to="/messages"
              search={{ proposal: proposal._id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Message client
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2 -mx-1 text-sm text-slate-700 transition-colors hover:bg-slate-50"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
    </Link>
  );
}

function ActivityItem({
  icon: Icon,
  text,
  time,
  color,
}: {
  icon: any;
  text: string;
  time: string;
  color: "emerald" | "blue" | "amber";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${colors[color]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 line-clamp-1">{text}</p>
        <p className="mt-0.5 text-xs text-slate-400">{time}</p>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: any;
  title: string;
  description: string;
  cta: { label: string; to: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{description}</p>
      <Link
        to={cta.to}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
      >
        {cta.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
