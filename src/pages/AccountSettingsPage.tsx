import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, User as UserIcon, Lock, AtSign, Briefcase } from "lucide-react";
import { useSession, useAuth } from "@/lib/auth-client";
import {
  apiUpdateProfile,
  apiChangePassword,
  apiChangeEmail,
  fetchMyExpertProfile,
} from "@/lib/api";
import {
  Container,
  Eyebrow,
  Button,
  FieldInput,
  FieldLabel,
  Tag,
} from "@/components/primitives";
import { toast } from "sonner";

type Tab = "profile" | "password" | "email" | "expert";

export function AccountSettingsPage() {
  const { data: session, isPending } = useSession();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("profile");
  const [hasExpertProfile, setHasExpertProfile] = useState(false);

  // Profile fields
  const [name, setName] = useState("");
  const [picture, setPicture] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Password fields
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Email fields
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  useEffect(() => {
    if (!session) return;
    setName(session.user.name ?? "");
    setPicture(session.user.image ?? "");
    fetchMyExpertProfile()
      .then((p) => setHasExpertProfile(Boolean(p)))
      .catch(() => setHasExpertProfile(false));
  }, [session]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-40" />
      </div>
    );
  }

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSubmitting(true);
    try {
      await apiUpdateProfile({ name: name.trim(), picture: picture.trim() || null });
      await refresh();
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { toast.error("New passwords don't match."); return; }
    setPwSubmitting(true);
    try {
      await apiChangePassword(currentPw, newPw);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      toast.success("Password changed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSubmitting(true);
    try {
      await apiChangeEmail(emailPw, newEmail.trim());
      setNewEmail(""); setEmailPw("");
      await refresh();
      toast.success("Email updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change email");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const isExpert = session.user.role === "expert";

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <Eyebrow index="§ 09" accent>Settings</Eyebrow>
        <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium tracking-[-0.02em] text-ink">
          Account
        </h1>
        <p className="mt-2 text-[14px] text-ink-60">
          Identity, credentials, and how the marketplace addresses you.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="space-y-1">
            <TabButton id="profile" active={tab} onClick={setTab} icon={<UserIcon className="h-4 w-4" />}>
              Profile
            </TabButton>
            <TabButton id="password" active={tab} onClick={setTab} icon={<Lock className="h-4 w-4" />}>
              Password
            </TabButton>
            <TabButton id="email" active={tab} onClick={setTab} icon={<AtSign className="h-4 w-4" />}>
              Email
            </TabButton>
            {isExpert && (
              <TabButton id="expert" active={tab} onClick={setTab} icon={<Briefcase className="h-4 w-4" />}>
                Expert profile
              </TabButton>
            )}
          </aside>

          <section className="rounded border border-ink-12 bg-white p-6 md:p-8">
            {tab === "profile" && (
              <form onSubmit={handleProfile} className="space-y-5" data-testid="profile-form">
                <header>
                  <h2 className="font-display text-[20px] font-medium text-ink">Profile</h2>
                  <p className="mt-1 text-[13px] text-ink-60">Public name and avatar shown across briefs, proposals, and contracts.</p>
                </header>
                <div className="flex items-center gap-4">
                  {picture ? (
                    <img src={picture} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-cream font-display text-[20px]">
                      {(name || session.user.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="text-[12.5px] text-ink-60">
                    <p>Role: <Tag tone="outline" size="sm">{session.user.role}</Tag></p>
                    <p className="mt-1 font-mono text-[11px] text-ink-40">{session.user._id}</p>
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="name">Display name</FieldLabel>
                  <FieldInput id="name" required value={name} onChange={(e) => setName(e.target.value)} data-testid="profile-name" />
                </div>
                <div>
                  <FieldLabel htmlFor="picture">Avatar URL (optional)</FieldLabel>
                  <FieldInput id="picture" type="url" value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://…" data-testid="profile-picture" />
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-40">PNG/JPG/WEBP · public CDN URL</p>
                </div>
                <Button
                  tone="ink"
                  size="md"
                  type="submit"
                  disabled={profileSubmitting}
                  data-testid="profile-save"
                  iconLeft={profileSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                >
                  {profileSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </form>
            )}

            {tab === "password" && (
              <form onSubmit={handlePassword} className="space-y-5" data-testid="password-form">
                <header>
                  <h2 className="font-display text-[20px] font-medium text-ink">Password</h2>
                  <p className="mt-1 text-[13px] text-ink-60">Use a passphrase you don't reuse elsewhere. Minimum 8 characters.</p>
                </header>
                <div>
                  <FieldLabel htmlFor="cpw">Current password</FieldLabel>
                  <FieldInput id="cpw" type="password" required autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} data-testid="password-current" />
                </div>
                <div>
                  <FieldLabel htmlFor="npw">New password</FieldLabel>
                  <FieldInput id="npw" type="password" required minLength={8} autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} data-testid="password-new" />
                </div>
                <div>
                  <FieldLabel htmlFor="cnpw">Confirm new password</FieldLabel>
                  <FieldInput id="cnpw" type="password" required minLength={8} autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} data-testid="password-confirm" />
                </div>
                <Button
                  tone="ink"
                  size="md"
                  type="submit"
                  disabled={pwSubmitting}
                  data-testid="password-save"
                  iconLeft={pwSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                >
                  {pwSubmitting ? "Saving…" : "Change password"}
                </Button>
              </form>
            )}

            {tab === "email" && (
              <form onSubmit={handleEmail} className="space-y-5" data-testid="email-form">
                <header>
                  <h2 className="font-display text-[20px] font-medium text-ink">Email</h2>
                  <p className="mt-1 text-[13px] text-ink-60">
                    Current: <strong className="text-ink">{session.user.email}</strong>
                  </p>
                </header>
                <div>
                  <FieldLabel htmlFor="newemail">New email</FieldLabel>
                  <FieldInput id="newemail" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@new-domain.com" data-testid="email-new" />
                </div>
                <div>
                  <FieldLabel htmlFor="epw">Confirm current password</FieldLabel>
                  <FieldInput id="epw" type="password" required autoComplete="current-password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} data-testid="email-password" />
                </div>
                <Button
                  tone="ink"
                  size="md"
                  type="submit"
                  disabled={emailSubmitting}
                  data-testid="email-save"
                  iconLeft={emailSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                >
                  {emailSubmitting ? "Saving…" : "Change email"}
                </Button>
              </form>
            )}

            {tab === "expert" && isExpert && (
              <div className="space-y-4">
                <header>
                  <h2 className="font-display text-[20px] font-medium text-ink">Expert profile</h2>
                  <p className="mt-1 text-[13px] text-ink-60">
                    Headline, specialties, rate, bio. {hasExpertProfile ? "Edit your published profile." : "Publish your profile to be discoverable."}
                  </p>
                </header>
                <Link
                  to="/onboarding/expert"
                  data-testid="expert-edit-link"
                  className="inline-flex h-11 items-center gap-2 rounded bg-ink px-4 text-[13px] font-semibold text-cream hover:bg-ink/90"
                >
                  {hasExpertProfile ? "Edit profile" : "Set up profile"}
                </Link>
              </div>
            )}
          </section>
        </div>
      </Container>
    </div>
  );
}

function TabButton({
  id,
  active,
  onClick,
  icon,
  children,
}: {
  id: Tab;
  active: Tab;
  onClick: (t: Tab) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isActive = active === id;
  return (
    <button
      type="button"
      data-testid={`settings-tab-${id}`}
      onClick={() => onClick(id)}
      className={`flex w-full items-center gap-2.5 rounded border px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors ${
        isActive
          ? "border-ink bg-ink text-cream"
          : "border-ink-12 bg-white text-ink hover:border-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
