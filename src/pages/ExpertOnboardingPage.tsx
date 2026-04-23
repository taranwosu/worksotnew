import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Check, Loader2, Compass, Plus, X, Save, Sparkles } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";

const CATEGORIES = [
  { id: "accounting", label: "Accounting & Finance", icon: "💼" },
  { id: "consulting", label: "Consulting & Strategy", icon: "🎯" },
  { id: "design", label: "Design & Creative", icon: "🎨" },
  { id: "engineering", label: "Engineering & Technical", icon: "⚙️" },
  { id: "compliance", label: "Compliance & Legal", icon: "⚖️" },
  { id: "marketing", label: "Marketing & Growth", icon: "📈" },
];

const STEP_TITLES = ["About You", "Expertise", "Rates", "Credentials"];

const DRAFT_KEY = "worksoy-expert-onboarding-draft";

type DraftState = {
  step: number;
  fullName: string;
  headline: string;
  bio: string;
  category: string;
  specialties: string[];
  yearsExperience: number;
  hourlyRate: number;
  location: string;
  timezone: string;
  availability: string;
  remoteOnly: boolean;
  linkedinUrl: string;
  websiteUrl: string;
  certifications: string[];
  languages: string[];
};

export function ExpertOnboardingPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const createProfile = useMutation(api.mutations.createExpertProfile);
  const existing = useQuery(api.queries.listExpertProfiles, session ? {} : "skip");

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const hasLoadedDraft = useRef(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState("consulting");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [yearsExperience, setYearsExperience] = useState(5);
  const [hourlyRate, setHourlyRate] = useState(150);
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [availability, setAvailability] = useState("full-time");
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certInput, setCertInput] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [langInput, setLangInput] = useState("");

  // Load draft from localStorage on mount
  useEffect(() => {
    if (hasLoadedDraft.current) return;
    hasLoadedDraft.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d: Partial<DraftState> = JSON.parse(raw);
        if (d.fullName) setFullName(d.fullName);
        if (d.headline) setHeadline(d.headline);
        if (d.bio) setBio(d.bio);
        if (d.category) setCategory(d.category);
        if (d.specialties) setSpecialties(d.specialties);
        if (d.yearsExperience) setYearsExperience(d.yearsExperience);
        if (d.hourlyRate) setHourlyRate(d.hourlyRate);
        if (d.location) setLocation(d.location);
        if (d.timezone) setTimezone(d.timezone);
        if (d.availability) setAvailability(d.availability);
        if (typeof d.remoteOnly === "boolean") setRemoteOnly(d.remoteOnly);
        if (d.linkedinUrl) setLinkedinUrl(d.linkedinUrl);
        if (d.websiteUrl) setWebsiteUrl(d.websiteUrl);
        if (d.certifications) setCertifications(d.certifications);
        if (d.languages) setLanguages(d.languages);
        if (d.step) setStep(d.step);
      }
    } catch {}
  }, []);

  // Prefill name from session if empty
  useEffect(() => {
    if (!fullName && session?.user?.name) {
      setFullName(session.user.name);
    }
  }, [session, fullName]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!hasLoadedDraft.current) return;
    const draft: DraftState = {
      step,
      fullName,
      headline,
      bio,
      category,
      specialties,
      yearsExperience,
      hourlyRate,
      location,
      timezone,
      availability,
      remoteOnly,
      linkedinUrl,
      websiteUrl,
      certifications,
      languages,
    };
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setDraftSaved(true);
        const hideTimer = setTimeout(() => setDraftSaved(false), 1500);
        return () => clearTimeout(hideTimer);
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [step, fullName, headline, bio, category, specialties, yearsExperience, hourlyRate, location, timezone, availability, remoteOnly, linkedinUrl, websiteUrl, certifications, languages]);

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

  if (existing && existing.length > 0) {
    navigate({ to: "/dashboard" });
    return null;
  }

  const addSkill = () => {
    if (skillInput.trim() && !specialties.includes(skillInput.trim())) {
      setSpecialties([...specialties, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const addCert = () => {
    if (certInput.trim() && !certifications.includes(certInput.trim())) {
      setCertifications([...certifications, certInput.trim()]);
      setCertInput("");
    }
  };

  const addLang = () => {
    if (langInput.trim() && !languages.includes(langInput.trim())) {
      setLanguages([...languages, langInput.trim()]);
      setLangInput("");
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await createProfile({
        fullName,
        headline,
        bio,
        category,
        specialties,
        hourlyRate,
        currency: "USD",
        location,
        timezone,
        yearsExperience,
        availability,
        remoteOnly,
        avatarUrl: session.user?.image ?? undefined,
        linkedinUrl: linkedinUrl || undefined,
        websiteUrl: websiteUrl || undefined,
        certifications,
        languages,
        rating: 0,
        reviewCount: 0,
        completedProjects: 0,
        isVerified: false,
        isPublished: true,
      });
      // Clear draft after successful submission
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setError(e?.message ?? "Failed to create profile");
      setSaving(false);
    }
  };

  const canNext1 = fullName.trim() && headline.trim() && bio.trim().length >= 50;
  const canNext2 = category && specialties.length >= 3 && yearsExperience > 0;
  const canNext3 = hourlyRate > 0 && location.trim() && timezone.trim();
  const canSubmit = canNext1 && canNext2 && canNext3;

  const progress = ((step - 1) / 4) * 100 + (step === 4 ? 25 : 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 shadow-sm">
              <Compass className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Set up your expert profile</h1>
          </div>
          {draftSaved && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Save className="h-3.5 w-3.5" />
              Draft saved
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs font-medium">
            <span className="text-slate-700">Step {step} of 4 · {STEP_TITLES[step - 1]}</span>
            <span className="text-slate-500">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-gradient-to-r from-slate-700 to-slate-900 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { if (n < step) setStep(n); }}
                disabled={n > step}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                  step >= n
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-500"
                } ${n < step ? "cursor-pointer hover:scale-110" : ""}`}
              >
                {step > n ? <Check className="h-4 w-4" /> : n}
              </button>
              {n < 4 && <div className={`h-0.5 w-12 transition-colors ${step > n ? "bg-slate-900" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Step 1: About You */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Tell us about you</h2>
                <p className="mt-1 text-sm text-slate-600">Start with the basics — your name, headline and a short bio.</p>
              </div>
              <FormField label="Full name">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="input"
                />
              </FormField>
              <FormField label="Professional headline" hint="One line — e.g. 'Senior FP&A Consultant for SaaS startups'">
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Senior Consultant for..."
                  maxLength={120}
                  className="input"
                />
              </FormField>
              <FormField label="Bio" hint={`${bio.length}/500 characters — minimum 50`}>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                  maxLength={500}
                  placeholder="Describe your experience, approach, and the kind of projects you excel at..."
                  className="input resize-none"
                />
              </FormField>
            </div>
          )}

          {/* Step 2: Expertise */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your expertise</h2>
                <p className="mt-1 text-sm text-slate-600">Help clients find you by selecting your specialty.</p>
              </div>
              <FormField label="Primary category">
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left text-sm font-medium transition-all ${
                        category === cat.id
                          ? "border-slate-900 bg-slate-50 text-slate-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="flex-1">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Skills & specialties" hint={`Add at least 3 (${specialties.length}/3)`}>
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
                {specialties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {specialties.map((s) => (
                      <span key={s} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {s}
                        <button type="button" onClick={() => setSpecialties(specialties.filter((x) => x !== s))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </FormField>
              <FormField label="Years of experience">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(parseInt(e.target.value) || 1)}
                  className="input"
                />
              </FormField>
            </div>
          )}

          {/* Step 3: Rates & Availability */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Rates & availability</h2>
                <p className="mt-1 text-sm text-slate-600">Set your pricing and how clients can work with you.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Hourly rate (USD)">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">$</span>
                    <input
                      type="number"
                      min={10}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(parseInt(e.target.value) || 0)}
                      className="input pl-7"
                    />
                  </div>
                </FormField>
                <FormField label="Availability">
                  <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="input">
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="project">Project-based</option>
                    <option value="limited">Limited capacity</option>
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Location">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="New York, NY"
                    className="input"
                  />
                </FormField>
                <FormField label="Timezone">
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="America/New_York"
                    className="input"
                  />
                </FormField>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="font-medium text-slate-700">Remote work only</span>
              </label>
            </div>
          )}

          {/* Step 4: Credentials */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Credentials (optional)</h2>
                <p className="mt-1 text-sm text-slate-600">Add certifications and links to boost your profile.</p>
              </div>
              <FormField label="Certifications">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={certInput}
                    onChange={(e) => setCertInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCert(); } }}
                    placeholder="e.g. CPA, PMP, AWS Certified"
                    className="input flex-1"
                  />
                  <button type="button" onClick={addCert} className="rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {certifications.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {certifications.map((c) => (
                      <span key={c} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                        {c}
                        <button type="button" onClick={() => setCertifications(certifications.filter((x) => x !== c))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </FormField>
              <FormField label="Languages">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={langInput}
                    onChange={(e) => setLangInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLang(); } }}
                    placeholder="e.g. Spanish"
                    className="input flex-1"
                  />
                  <button type="button" onClick={addLang} className="rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {languages.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {languages.map((l) => (
                      <span key={l} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {l}
                        {l !== "English" && (
                          <button type="button" onClick={() => setLanguages(languages.filter((x) => x !== l))}>
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </FormField>
              <FormField label="LinkedIn URL (optional)">
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="input"
                />
              </FormField>
              <FormField label="Personal website (optional)">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="input"
                />
              </FormField>

              {/* Review summary */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Profile summary
                </div>
                <dl className="space-y-1.5 text-xs">
                  <SummaryRow label="Name" value={fullName} />
                  <SummaryRow label="Headline" value={headline} />
                  <SummaryRow label="Category" value={CATEGORIES.find((c) => c.id === category)?.label ?? category} />
                  <SummaryRow label="Skills" value={`${specialties.length} added`} />
                  <SummaryRow label="Rate" value={`$${hourlyRate}/hr`} />
                  <SummaryRow label="Experience" value={`${yearsExperience} years`} />
                </dl>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md disabled:opacity-40 disabled:hover:shadow-sm"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || saving}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "Creating..." : "Publish profile"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Your progress is automatically saved as you type. You can close this page and return to continue later.
        </p>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[60%] truncate font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
