import { LegalPage, type LegalSection } from "./LegalPage";
import { usePageMeta } from "@/lib/seo";

const sections: LegalSection[] = [
  {
    heading: "Purpose of this policy",
    body: (
      <>
        <p>
          This Acceptable Use Policy (the &ldquo;Policy&rdquo;) describes
          conduct that is prohibited on WorkSoy. It supplements, and is part of,
          our Terms of Service. By using the Services you agree to follow this
          Policy. We may update it from time to time; material changes will be
          announced through the Services.
        </p>
      </>
    ),
  },
  {
    heading: "Prohibited activity",
    body: (
      <>
        <p>You may not use WorkSoy to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>break the law, infringe intellectual-property or privacy rights, or evade sanctions or export controls;</li>
          <li>misrepresent your identity, credentials, employment, or availability;</li>
          <li>post fraudulent briefs, fake proposals, or fabricated reviews;</li>
          <li>upload malware, run security scans, scrape data, or otherwise interfere with the Services;</li>
          <li>harass, threaten, or discriminate against other users or our team;</li>
          <li>share content that is hateful, sexually exploitative, or promotes violence.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "No off-platform circumvention",
    body: (
      <>
        <p>
          The escrow, fees, and matching that protect both sides only work when
          engagements stay on WorkSoy. You agree not to solicit or arrange
          payment outside the platform to avoid fees, bypass escrow, or evade
          dispute protection for work introduced through WorkSoy.
        </p>
      </>
    ),
  },
  {
    heading: "Accurate work and payments",
    body: (
      <>
        <p>
          Experts must deliver the work they agree to and represent their skills
          honestly. Clients must fund milestones in good faith and review
          deliverables fairly. Neither party may use the dispute process to
          extract free work or withhold legitimately earned funds.
        </p>
      </>
    ),
  },
  {
    heading: "Data and confidentiality",
    body: (
      <>
        <p>
          Treat files, briefs, and messages shared in an engagement as
          confidential to that engagement. Do not repurpose another user&rsquo;s
          materials, personal data, or contact details for unrelated outreach,
          marketing, or resale.
        </p>
      </>
    ),
  },
  {
    heading: "Reporting and enforcement",
    body: (
      <>
        <p>
          Report abuse to{" "}
          <a className="underline" href="mailto:trust@worksoy.com">
            trust@worksoy.com
          </a>
          . We may investigate suspected violations and, at our discretion,
          remove content, limit features, withhold disputed funds pending
          review, or suspend and terminate accounts. Serious violations may be
          referred to law enforcement.
        </p>
      </>
    ),
  },
];

export function AcceptableUsePage() {
  usePageMeta({
    title: "Acceptable Use Policy",
    description:
      "What's allowed and what's prohibited on WorkSoy — conduct, off-platform circumvention, data use, and enforcement.",
    path: "/legal/acceptable-use",
  });
  return (
    <LegalPage
      index="§ 03"
      eyebrow="Acceptable Use Policy"
      title="How to behave on the platform."
      effectiveDate="2026-06-10"
      intro={
        <>
          The ground rules that keep WorkSoy safe and fair for clients and
          experts alike. Breaking them can cost you access to the network.
        </>
      }
      sections={sections}
    />
  );
}
