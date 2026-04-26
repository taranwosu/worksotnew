import { useState } from "react";
import { Mail, Building2, PhoneCall, MapPin, Check } from "lucide-react";
import {
  Container,
  Eyebrow,
  Button,
  FieldInput,
  FieldLabel,
  FieldTextarea,
  FieldSelect,
  FieldHint,
} from "@/components/primitives";
import { submitContact, type ContactInput } from "@/lib/api";

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ContactInput>({
    name: "",
    email: "",
    company: "",
    topic: "general",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company?.trim() || undefined,
        topic: form.topic,
        message: form.message.trim(),
      });
      setSubmitted(true);
      setForm({ name: "", email: "", company: "", topic: "general", message: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-cream">
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index="§ 01" accent>
              Writing desk
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              Reply in &lt; 1 business day
            </span>
          </div>
          <div className="grid grid-cols-1 gap-10 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">
                Write us.
                <br />
                We <em className="italic">actually</em> read it.
              </h1>
            </div>
            <div className="md:col-span-4 md:pt-4">
              <p className="prose-lede">
                No chatbots, no routing mazes. Every message lands with a named
                person on our operations or bench team within one business day
                — often inside the hour.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 md:py-24">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
            {/* Left — desks & locations */}
            <aside className="md:col-span-5">
              <Eyebrow index="§ 02" accent>
                The desks
              </Eyebrow>
              <h2 className="mt-4 font-display text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-[1.1] tracking-[-0.02em] text-ink">
                Four ways in, one person behind each.
              </h2>

              <ul className="mt-10 divide-y divide-ink-12 border-y border-ink-12">
                {[
                  {
                    icon: Mail,
                    label: "General",
                    value: "hello@worksoy.com",
                    note: "Ops team · Mon–Fri",
                  },
                  {
                    icon: Building2,
                    label: "Bench / Enterprise",
                    value: "bench@worksoy.com",
                    note: "Enterprise lead · Named",
                  },
                  {
                    icon: PhoneCall,
                    label: "Applying as a contractor",
                    value: "apply@worksoy.com",
                    note: "Roster committee",
                  },
                  {
                    icon: MapPin,
                    label: "Press / partnerships",
                    value: "press@worksoy.com",
                    note: "Comms desk",
                  },
                ].map((d) => (
                  <li
                    key={d.label}
                    className="flex items-center justify-between gap-4 py-5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded bg-cream-2 text-ink">
                        <d.icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                          {d.label}
                        </p>
                        <p className="mt-1 font-display text-[15.5px] font-medium text-ink">
                          {d.value}
                        </p>
                        <p className="text-[11.5px] text-ink-40">{d.note}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-10 grid grid-cols-2 gap-4">
                {[
                  ["New York", "1 Broadway · NY"],
                  ["London", "22 Hanover Sq · W1"],
                  ["Remote", "Global · async"],
                ].map(([place, addr]) => (
                  <div
                    key={place}
                    className="rounded border border-ink-12 bg-white p-4"
                  >
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                      {place}
                    </p>
                    <p className="mt-1.5 font-display text-[14px] font-medium text-ink">
                      {addr}
                    </p>
                  </div>
                ))}
              </div>
            </aside>

            {/* Right — form */}
            <div className="md:col-span-7">
              <div className="rounded border border-ink-12 bg-white">
                <div className="flex items-center justify-between border-b border-ink-12 bg-cream-2 px-6 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                    Message · 2026-04
                  </p>
                  <p className="font-mono text-[11px] tabular text-ink-60">
                    04 fields
                  </p>
                </div>

                {submitted ? (
                  <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sun">
                      <Check className="h-6 w-6 text-ink" strokeWidth={2.5} />
                    </div>
                    <h3 className="font-display text-2xl font-medium text-ink">
                      Message filed.
                    </h3>
                    <p className="max-w-sm text-[14px] leading-relaxed text-ink-60">
                      A named human from our operations team will reply within
                      one business day. If it is urgent, prefix the subject
                      line with{" "}
                      <span className="font-mono">[URGENT]</span>.
                    </p>
                    <Button
                      tone="outline"
                      size="md"
                      onClick={() => setSubmitted(false)}
                    >
                      Send another
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-2 gap-4 p-6"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="name">
                        Your name <span className="text-rust">*</span>
                      </FieldLabel>
                      <FieldInput
                        id="name"
                        required
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="email">
                        Work email <span className="text-rust">*</span>
                      </FieldLabel>
                      <FieldInput
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="company">Company</FieldLabel>
                      <FieldInput
                        id="company"
                        value={form.company}
                        onChange={(e) =>
                          setForm({ ...form, company: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel htmlFor="topic">Desk</FieldLabel>
                      <FieldSelect
                        id="topic"
                        value={form.topic}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            topic: e.target.value as ContactInput["topic"],
                          })
                        }
                      >
                        <option value="general">General inquiry</option>
                        <option value="bench">Bench / enterprise</option>
                        <option value="apply">Apply as a contractor</option>
                        <option value="press">Press / partnerships</option>
                      </FieldSelect>
                    </div>
                    <div className="col-span-2">
                      <FieldLabel htmlFor="message">
                        Message <span className="text-rust">*</span>
                      </FieldLabel>
                      <FieldTextarea
                        id="message"
                        required
                        rows={6}
                        value={form.message}
                        onChange={(e) =>
                          setForm({ ...form, message: e.target.value })
                        }
                        placeholder="A short paragraph is plenty. Tell us the context, the ask, and the date it matters by."
                      />
                      <FieldHint>
                        We reply inside one business day — often within the
                        hour between 09:00–19:00 ET.
                      </FieldHint>
                    </div>
                    {error && (
                      <div className="col-span-2 rounded border border-rust/40 bg-rust/5 px-4 py-3 text-[13px] text-rust">
                        {error}
                      </div>
                    )}
                    <div className="col-span-2 flex items-center justify-between gap-4 border-t border-ink-12 pt-5">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                        Confidential · never sold
                      </p>
                      <Button
                        tone="ink"
                        size="lg"
                        arrow
                        type="submit"
                        disabled={submitting}
                      >
                        {submitting ? "Sending…" : "Send message"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
