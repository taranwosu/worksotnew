import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Loader2, Plus, X, Check } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";

const CATEGORIES = [
  { id: "accounting", label: "Accounting & Finance" },
  { id: "consulting", label: "Consulting & Strategy" },
  { id: "design", label: "Design & Creative" },
  { id: "engineering", label: "Engineering & Technical" },
  { id: "compliance", label: "Compliance & Legal" },
  { id: "marketing", label: "Marketing & Growth" },
];

export function PostRequestPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const createRequest = useMutation(api.mutations.createClientRequest);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("consulting");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [budgetMin, setBudgetMin] = useState(5000);
  const [budgetMax, setBudgetMax] = useState(15000);
  const [budgetType, setBudgetType] = useState("fixed");
  const [engagementType, setEngagementType] = useState("project");
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [startDate, setStartDate] = useState("");
  const [location, setLocation] = useState("Remote");
  const [remoteOk, setRemoteOk] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState(session?.user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createRequest({
        title,
        description,
        category,
        requiredSkills: skills,
        budgetMin,
        budgetMax,
        currency: "USD",
        budgetType,
        engagementType,
        durationWeeks,
        startDate: startDate || undefined,
        location,
        remoteOk,
        complianceRequirements: [],
        status: "open",
        proposalCount: 0,
        companyName: companyName || undefined,
        contactEmail: contactEmail || undefined,
      });
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err?.message ?? "Failed to post request");
      setSaving(false);
    }
  };

  const canSubmit = title.trim() && description.length >= 50 && skills.length > 0 && budgetMax >= budgetMin;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Post a project</h1>
        <p className="mt-2 text-slate-600">Describe your project and we'll match you with the right experts.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Project Details */}
        <Section title="Project details">
          <Field label="Project title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Financial Model and Board Deck"
              required
              maxLength={120}
              className="input"
            />
          </Field>
          <Field label="Description" hint={`${description.length}/2000 — minimum 50 characters`}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              maxLength={2000}
              required
              placeholder="Describe the scope, deliverables, context, and any specific requirements..."
              className="input resize-none"
            />
          </Field>
          <Field label="Category">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`rounded-lg border-2 p-3 text-left text-sm font-medium transition-all ${
                    category === cat.id
                      ? "border-slate-900 bg-slate-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Required skills" hint="Press Enter or + to add">
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="e.g. Financial Modeling"
                className="input flex-1"
              />
              <button type="button" onClick={addSkill} className="rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span key={s} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {s}
                    <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </Section>

        {/* Budget & Timeline */}
        <Section title="Budget & timeline">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Budget type">
              <select value={budgetType} onChange={(e) => setBudgetType(e.target.value)} className="input">
                <option value="fixed">Fixed price</option>
                <option value="hourly">Hourly</option>
              </select>
            </Field>
            <Field label="Engagement type">
              <select value={engagementType} onChange={(e) => setEngagementType(e.target.value)} className="input">
                <option value="project">One-time project</option>
                <option value="retainer">Ongoing retainer</option>
                <option value="contract">Contract role</option>
              </select>
            </Field>
            <Field label="Budget min (USD)">
              <input type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(parseInt(e.target.value) || 0)} className="input" />
            </Field>
            <Field label="Budget max (USD)">
              <input type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(parseInt(e.target.value) || 0)} className="input" />
            </Field>
            <Field label="Duration (weeks)">
              <input type="number" min={1} value={durationWeeks} onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 1)} className="input" />
            </Field>
            <Field label="Desired start date (optional)">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
            </Field>
          </div>
        </Section>

        {/* Location & Contact */}
        <Section title="Location & contact">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location">
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote / City, State" className="input" />
            </Field>
            <Field label="Company name (optional)">
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input" />
            </Field>
            <Field label="Contact email">
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="input" />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={remoteOk}
              onChange={(e) => setRemoteOk(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="font-medium text-slate-700">Remote work is acceptable</span>
          </label>
        </Section>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Posting..." : "Post project"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
