import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, User as UserIcon, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useSession, useAuth } from "@/lib/auth-client";
import { updateMyAccount, changeMyPassword } from "@/lib/api";
import { Container, Eyebrow, Button, FieldLabel, FieldInput, FieldHint } from "@/components/primitives";
import { usePageMeta } from "@/lib/seo";

export function AccountSettingsPage() {
  usePageMeta({ title: "Account settings", path: "/settings", robots: "noindex,nofollow" });
  const { data: session, isPending } = useSession();
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [picture, setPicture] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  useEffect(() => {
    if (session) {
      setName(session.user.name ?? "");
      setPicture(session.user.image ?? "");
    }
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
    if (!name.trim()) {
      toast.error("Name can't be empty");
      return;
    }
    setSavingProfile(true);
    try {
      await updateMyAccount({ name: name.trim(), picture: picture.trim() || null });
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setSavingPassword(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initial = (name || session.user.email).charAt(0).toUpperCase();

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container className="max-w-2xl">
        <Eyebrow index="§ 07" accent>Account</Eyebrow>
        <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium tracking-[-0.02em] text-ink">
          Settings
        </h1>
        <p className="mt-2 text-[14px] text-ink-60">
          Update how you appear across WorkSoy and manage your password.
        </p>

        {/* Profile */}
        <form onSubmit={handleProfile} className="mt-10 rounded border border-ink-12 bg-white p-6">
          <div className="flex items-center gap-2 border-b border-ink-10 pb-3">
            <UserIcon className="h-4 w-4 text-ink-60" />
            <h2 className="font-display text-[18px] font-medium text-ink">Profile</h2>
          </div>

          <div className="mt-5 flex items-center gap-4">
            {picture.trim() ? (
              <img src={picture} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-[18px] font-semibold text-cream">
                {initial}
              </span>
            )}
            <div className="text-[13px] text-ink-60">
              <p className="font-semibold text-ink">{session.user.email}</p>
              <p>Email is used for sign-in and can't be changed here.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
              <FieldInput id="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <FieldLabel htmlFor="picture">Profile picture URL</FieldLabel>
              <FieldInput id="picture" type="url" value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://…" />
              <FieldHint>Paste a link to an image. Leave blank to use your initials.</FieldHint>
            </div>
          </div>

          <Button data-testid="save-profile" tone="ink" size="md" type="submit" disabled={savingProfile} className="mt-5">
            {savingProfile ? "Saving…" : "Save profile"}
          </Button>
        </form>

        {/* Password */}
        <form onSubmit={handlePassword} className="mt-6 rounded border border-ink-12 bg-white p-6">
          <div className="flex items-center gap-2 border-b border-ink-10 pb-3">
            <KeyRound className="h-4 w-4 text-ink-60" />
            <h2 className="font-display text-[18px] font-medium text-ink">Password</h2>
          </div>
          <p className="mt-3 text-[12.5px] text-ink-60">
            Changing your password signs out your other devices. If you signed up with Google, password change isn't available.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="current">Current password</FieldLabel>
              <FieldInput id="current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div>
              <FieldLabel htmlFor="new">New password</FieldLabel>
              <FieldInput id="new" type="password" value={newPassword} minLength={8} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            <div>
              <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
              <FieldInput id="confirm" type="password" value={confirmPassword} minLength={8} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
            </div>
          </div>
          <Button data-testid="save-password" tone="ink" size="md" type="submit" disabled={savingPassword} className="mt-5">
            {savingPassword ? "Updating…" : "Change password"}
          </Button>
        </form>
      </Container>
    </div>
  );
}
