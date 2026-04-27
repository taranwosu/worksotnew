import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { createBrief } from "@/lib/api";
import { track } from "@/lib/analytics";
import {
  Container,
  Eyebrow,
  Button,
  FieldInput,
  FieldLabel,
  FieldTextarea,
  Tag,
} from "@/components/primitives";

const CATEGORIES = [
  "Accounting & Tax",
  "Consulting",
  "Design & UX",
  "Engineering",
  "Compliance",
  "Project Management",
];

export function PostRequestPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: CATEGORIES[0],
    required_skills: "",
    budget_min: "3000",
    budget_max: "8000",
    duration_weeks: "8",
    engagement_type: "fixed" as "fixed" | "hourly" | "retainer",
    remote_ok: true,
    location: "Remote",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      navigate({ to: "/signin" });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const brief = await createBrief({
        title: form.title,
        description: form.description,
        category: form.category,
        required_skills: form.required_skills.split(",").map((s) => s.trim()).filter(Boolean),
        budget_min: parseInt(form.budget_min, 10) || 0,
        budget_max: parseInt(form.budget_max, 10) || 0,
        currency: "USD",
        engagement_type: form.engagement_type,
        duration_weeks: parseInt(form.duration_weeks, 10) || 4,
        remote_ok: form.remote_ok,
        location: form.location,
      });
      track("brief.created", {
        brief_id: brief.id,
        category: brief.category,
        budget_min: brief.budget_min,
        budget_max: brief.budget_max,
        engagement_type: brief.engagement_type,
      });
      navigate({ to: "/briefs/$briefId", params: { briefId: brief.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post brief");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <div className="mx-auto max-w-2xl">
          <Eyebrow index="§ 03" accent>Post a brief</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
            Tell us the work — we&rsquo;ll return three finalists.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-60">
            A human reads every brief within the hour. Shortlist lands inside 48 hours.
          </p>

          {error && (
            <div role="alert" className="mt-6 rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <FieldInput
                id="title"
                required
                minLength={3}
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Fractional CFO for Series A SaaS"
              />
            </div>

            <div>
              <FieldLabel htmlFor="description">The work</FieldLabel>
              <FieldTextarea
                id="description"
                required
                minLength={20}
                rows={6}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Outline the scope, timeline, deliverables, and what success looks like."
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="h-11 w-full rounded border border-ink-20 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="skills">Key skills (comma separated)</FieldLabel>
                <FieldInput
                  id="skills"
                  value={form.required_skills}
                  onChange={(e) => handleChange("required_skills", e.target.value)}
                  placeholder="Fundraising, Financial Modeling"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <FieldLabel htmlFor="budget_min">Budget min (USD)</FieldLabel>
                <FieldInput id="budget_min" type="number" min={0} value={form.budget_min} onChange={(e) => handleChange("budget_min", e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="budget_max">Budget max (USD)</FieldLabel>
                <FieldInput id="budget_max" type="number" min={0} value={form.budget_max} onChange={(e) => handleChange("budget_max", e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="weeks">Duration (weeks)</FieldLabel>
                <FieldInput id="weeks" type="number" min={1} max={104} value={form.duration_weeks} onChange={(e) => handleChange("duration_weeks", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="engagement">Engagement type</FieldLabel>
                <select
                  id="engagement"
                  value={form.engagement_type}
                  onChange={(e) => handleChange("engagement_type", e.target.value as "fixed" | "hourly" | "retainer")}
                  className="h-11 w-full rounded border border-ink-20 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none"
                >
                  <option value="fixed">Fixed-fee</option>
                  <option value="hourly">Hourly</option>
                  <option value="retainer">Retainer</option>
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="location">Location</FieldLabel>
                <FieldInput id="location" value={form.location} onChange={(e) => handleChange("location", e.target.value)} placeholder="Remote, New York, NY, etc." />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Tag tone="outline" size="sm">Preview</Tag>
              <span className="text-[13px] text-ink-60">Only the WorkSoy matcher team sees the brief until experts apply.</span>
            </div>

            <Button
              data-testid="post-brief-submit"
              tone="ink"
              size="lg"
              type="submit"
              disabled={submitting}
              className="w-full"
              iconLeft={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              arrow={!submitting}
            >
              {submitting ? "Posting…" : "Post brief"}
            </Button>
          </form>
        </div>
      </Container>
    </div>
  );
}
