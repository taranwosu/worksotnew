import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { upsertMyExpertProfile, fetchMyExpertProfile } from "@/lib/api";
import {
  Container,
  Eyebrow,
  Button,
  FieldInput,
  FieldLabel,
  FieldTextarea,
} from "@/components/primitives";

const CATEGORIES = [
  "Accounting & Tax",
  "Consulting",
  "Design & UX",
  "Engineering",
  "Compliance",
  "Project Management",
];

export function ExpertOnboardingPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [form, setForm] = useState({
    headline: "",
    category: CATEGORIES[0],
    specialties: "",
    hourlyRate: "150",
    location: "Remote",
    yearsExperience: "8",
    bio: "",
    availability: "Available now",
    image: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  useEffect(() => {
    if (!session) return;
    fetchMyExpertProfile()
      .then((p) => {
        if (p) {
          setForm((f) => ({
            ...f,
            headline: p.headline,
            category: p.category,
            specialties: p.specialties.join(", "),
            hourlyRate: String(p.hourlyRate),
            location: p.location,
            yearsExperience: String(p.yearsExperience),
            bio: p.bio,
            availability: p.availability,
            image: p.image ?? "",
          }));
        }
      })
      .catch(() => {});
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      await upsertMyExpertProfile({
        headline: form.headline,
        category: form.category,
        specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        hourlyRate: parseInt(form.hourlyRate, 10) || 0,
        location: form.location,
        yearsExperience: parseInt(form.yearsExperience, 10) || 0,
        bio: form.bio,
        availability: form.availability,
        image: form.image || undefined,
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <div className="mx-auto max-w-2xl">
          <Eyebrow index="§ 04" accent>Roster application</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
            Tell us about your practice.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-60">
            Your profile goes live immediately. The <em>Verified</em> badge is awarded after our team reviews your references.
          </p>

          {error && (
            <div role="alert" className="mt-6 rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <FieldLabel htmlFor="headline">Headline</FieldLabel>
              <FieldInput id="headline" required value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="Fractional CFO · SaaS & marketplaces" />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="category">Practice</FieldLabel>
                <select id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-11 w-full rounded border border-ink-20 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="avail">Availability</FieldLabel>
                <select id="avail" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })}
                  className="h-11 w-full rounded border border-ink-20 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none">
                  <option>Available now</option>
                  <option>Available next week</option>
                  <option>Available in 2 weeks</option>
                </select>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="specialties">Specialties (comma separated)</FieldLabel>
              <FieldInput id="specialties" required value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} placeholder="Fundraising, Financial Modeling, Board Reporting" />
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <FieldLabel htmlFor="rate">Hourly rate (USD)</FieldLabel>
                <FieldInput id="rate" type="number" min={10} max={2000} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
              </div>
              <div>
                <FieldLabel htmlFor="years">Years of experience</FieldLabel>
                <FieldInput id="years" type="number" min={0} max={60} value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} />
              </div>
              <div>
                <FieldLabel htmlFor="loc">Location</FieldLabel>
                <FieldInput id="loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="image">Portrait URL (optional)</FieldLabel>
              <FieldInput id="image" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…/me.jpg" />
            </div>
            <div>
              <FieldLabel htmlFor="bio">Your bio</FieldLabel>
              <FieldTextarea id="bio" required minLength={30} rows={6} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Who you help, how you help, and the outcomes you produce." />
            </div>
            <Button data-testid="onboard-submit" tone="ink" size="lg" type="submit" disabled={saving} className="w-full" iconLeft={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} arrow={!saving}>
              {saving ? "Saving…" : "Publish profile"}
            </Button>
          </form>
        </div>
      </Container>
    </div>
  );
}
