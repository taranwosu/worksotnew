import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Loader2, Plus, X, Check } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";
import {
  Container,
  Eyebrow,
  Button,
  Tag,
  FieldInput,
  FieldLabel,
  FieldTextarea,
  FieldSelect,
  FieldHint,
} from "@/components/primitives";
import { cn } from "@/lib/utils";

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
      <div className="flex min-h-[60vh] items-center justify-center bg-cream">
        <Loader2 className="h-6 w-6 animate-spin text-ink-40" />
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

  const canSubmit =
    title.trim() &&
    description.length >= 50 &&
    skills.length > 0 &&
    budgetMax >= budgetMin;

  return (
    <div className="bg-cream pb-24">
      {/* Title band */}
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index="§ 01" accent>
              The brief
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              ~ 10 min · A matcher reads it inside the hour
            </span>
          </div>
          <div className="grid grid-cols-1 gap-8 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">
                Tell us what
                <br className="hidden md:block" /> needs to move.
              </h1>
            </div>
            <div className="md:col-span-4 md:pt-4">
              <p className="prose-lede">
                Plain language beats perfect prose. Focus on the decision the
                work informs, the start date, and the budget band you actually
                have. We handle the rest.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <Container className="mt-12">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded border border-rust/30 bg-rust/5 px-4 py-3 text-[13px] text-rust"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
          {/* Stepper sidebar */}
          <aside className="md:col-span-3">
            <ol className="md:sticky md:top-28 md:space-y-2">
              {[
                ["01", "Project details"],
                ["02", "Budget & timeline"],
                ["03", "Location & contact"],
              ].map(([n, l]) => (
                <li
                  key={n}
                  className="flex items-center gap-3 border-b border-ink-10 py-3 md:border-b-0 md:py-2"
                >
                  <span className="font-mono text-[11px] tracking-[0.14em] text-ink-60">
                    {n}
                  </span>
                  <span className="text-[13.5px] font-medium text-ink">
                    {l}
                  </span>
                </li>
              ))}
            </ol>
          </aside>

          <div className="space-y-10 md:col-span-9">
            <Section title="Project details" index="01">
              <div>
                <FieldLabel htmlFor="title">
                  Project title <span className="text-rust">*</span>
                </FieldLabel>
                <FieldInput
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q1 financial model + board deck"
                  required
                  maxLength={120}
                />
              </div>

              <div>
                <FieldLabel htmlFor="description">
                  Description <span className="text-rust">*</span>
                </FieldLabel>
                <FieldTextarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={7}
                  maxLength={2000}
                  required
                  placeholder="Scope, deliverables, context, the decision the work needs to inform…"
                />
                <FieldHint>
                  {description.length}/2000 · minimum 50 characters
                </FieldHint>
              </div>

              <div>
                <FieldLabel>Category</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "rounded border px-3.5 py-3 text-left text-[13.5px] font-medium transition-colors",
                        category === cat.id
                          ? "border-ink bg-ink text-cream"
                          : "border-ink-12 bg-white text-ink hover:border-ink",
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="skills">Required skills</FieldLabel>
                <div className="flex gap-2">
                  <FieldInput
                    id="skills"
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="e.g. Financial Modeling"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={addSkill}
                    tone="ink"
                    size="md"
                    className="!px-4"
                    aria-label="Add skill"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <FieldHint>Press Enter or + to add</FieldHint>
                {skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 rounded-sm bg-ink-08 px-2.5 py-1 text-[12px] font-medium text-ink"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() =>
                            setSkills(skills.filter((x) => x !== s))
                          }
                          className="text-ink-60 hover:text-ink"
                          aria-label={`Remove ${s}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section title="Budget & timeline" index="02">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="budgetType">Budget type</FieldLabel>
                  <FieldSelect
                    id="budgetType"
                    value={budgetType}
                    onChange={(e) => setBudgetType(e.target.value)}
                  >
                    <option value="fixed">Fixed price</option>
                    <option value="hourly">Hourly</option>
                  </FieldSelect>
                </div>
                <div>
                  <FieldLabel htmlFor="engagementType">
                    Engagement type
                  </FieldLabel>
                  <FieldSelect
                    id="engagementType"
                    value={engagementType}
                    onChange={(e) => setEngagementType(e.target.value)}
                  >
                    <option value="project">One-time project</option>
                    <option value="retainer">Ongoing retainer</option>
                    <option value="contract">Contract role</option>
                  </FieldSelect>
                </div>
                <div>
                  <FieldLabel htmlFor="budgetMin">Budget min (USD)</FieldLabel>
                  <FieldInput
                    id="budgetMin"
                    type="number"
                    min={0}
                    value={budgetMin}
                    onChange={(e) =>
                      setBudgetMin(parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="budgetMax">Budget max (USD)</FieldLabel>
                  <FieldInput
                    id="budgetMax"
                    type="number"
                    min={0}
                    value={budgetMax}
                    onChange={(e) =>
                      setBudgetMax(parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="durationWeeks">
                    Duration (weeks)
                  </FieldLabel>
                  <FieldInput
                    id="durationWeeks"
                    type="number"
                    min={1}
                    value={durationWeeks}
                    onChange={(e) =>
                      setDurationWeeks(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="startDate">
                    Desired start date
                  </FieldLabel>
                  <FieldInput
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>
            </Section>

            <Section title="Location & contact" index="03">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <FieldInput
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Remote / City, State"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="companyName">Company name</FieldLabel>
                  <FieldInput
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
                  <FieldInput
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 rounded border border-ink-12 bg-cream-2 px-4 py-3 text-[13.5px]">
                <input
                  type="checkbox"
                  checked={remoteOk}
                  onChange={(e) => setRemoteOk(e.target.checked)}
                  className="h-4 w-4 accent-ink"
                />
                <span className="font-medium text-ink">
                  Remote engagements welcome
                </span>
                <Tag tone="outline" size="sm" className="ml-auto">
                  Most briefs
                </Tag>
              </label>
            </Section>

            <div className="flex items-center justify-end gap-3 border-t border-ink-12 pt-6">
              <Button
                type="button"
                tone="ghost"
                size="md"
                onClick={() => navigate({ to: "/dashboard" })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                tone="ink"
                size="lg"
                disabled={!canSubmit || saving}
                iconLeft={
                  saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  )
                }
                arrow={!saving}
              >
                {saving ? "Filing brief…" : "File the brief"}
              </Button>
            </div>
          </div>
        </form>
      </Container>
    </div>
  );
}

function Section({
  title,
  index,
  children,
}: {
  title: string;
  index: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded border border-ink-12 bg-white">
      <legend className="-ml-1 ml-5 flex items-center gap-2 bg-cream px-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
        <span className="text-ink">{index}</span>
        <span className="text-ink-20">/</span>
        <span>{title}</span>
      </legend>
      <div className="space-y-5 p-6 md:p-8">{children}</div>
    </fieldset>
  );
}
