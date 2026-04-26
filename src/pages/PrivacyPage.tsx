import { LegalPage, type LegalSection } from "./LegalPage";
import { usePageMeta } from "@/lib/seo";

const sections: LegalSection[] = [
  {
    heading: "Summary",
    body: (
      <>
        <p>
          This Privacy Policy explains what personal data WorkSoy Networks, Inc.
          (&ldquo;WorkSoy&rdquo;) collects, why we collect it, how we use it,
          and the choices you have. We do not sell personal data.
        </p>
      </>
    ),
  },
  {
    heading: "Data we collect",
    body: (
      <>
        <p>We collect personal data in three ways:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Information you provide</strong> — account details (name,
            email, role), expert profile content, briefs and proposals,
            messages and uploaded files, contact-form submissions, and payment
            details that you share with our payment processor.
          </li>
          <li>
            <strong>Information from third parties</strong> — identity
            information from Google when you sign in with Google; payment and
            payout metadata from Stripe.
          </li>
          <li>
            <strong>Information collected automatically</strong> — log data
            (IP address, browser type, pages viewed), device identifiers, and
            cookie identifiers used for authentication and analytics.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: "How we use data",
    body: (
      <>
        <p>We use personal data to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>operate accounts, briefs, proposals, contracts and messaging;</li>
          <li>match clients with appropriate experts;</li>
          <li>process payments and hold milestone funds in escrow;</li>
          <li>provide customer support and resolve disputes;</li>
          <li>monitor for fraud, abuse, and security incidents;</li>
          <li>improve the Services and develop new features;</li>
          <li>send transactional and, with consent, marketing emails;</li>
          <li>comply with legal and regulatory obligations.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Legal bases (EEA / UK)",
    body: (
      <>
        <p>
          Where the GDPR or UK GDPR applies, we rely on the following legal
          bases: performance of a contract, our legitimate interests in
          operating and improving the Services, your consent (where required,
          for example for marketing emails), and compliance with legal
          obligations.
        </p>
      </>
    ),
  },
  {
    heading: "Sharing",
    body: (
      <>
        <p>We share personal data only as needed to operate the Services:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Counterparties.</strong> Clients see relevant expert
            profile data; experts see relevant brief and contract data.
          </li>
          <li>
            <strong>Service providers.</strong> Payment processor (Stripe),
            cloud infrastructure (hosting, database), email and authentication
            providers, error monitoring. These are bound by data-processing
            agreements.
          </li>
          <li>
            <strong>Legal and safety.</strong> When required by law, court
            order, or to protect rights, property, or safety.
          </li>
          <li>
            <strong>Business transfers.</strong> In connection with a merger,
            acquisition, or asset sale, with notice where required.
          </li>
        </ul>
        <p>We do not sell personal data and do not share it for cross-context behavioural advertising.</p>
      </>
    ),
  },
  {
    heading: "Cookies and similar technologies",
    body: (
      <>
        <p>
          We use a small number of first-party cookies for authentication
          (session token), security, and product analytics. You can control
          cookies in your browser settings. Disabling required cookies may stop
          parts of the Services from working.
        </p>
      </>
    ),
  },
  {
    heading: "Data retention",
    body: (
      <>
        <p>
          We retain personal data for as long as your account is active or as
          needed to provide the Services, comply with legal obligations,
          resolve disputes, and enforce agreements. Backups containing personal
          data are deleted on a rolling schedule.
        </p>
      </>
    ),
  },
  {
    heading: "Your rights",
    body: (
      <>
        <p>
          Depending on where you live, you may have the right to access,
          correct, delete, port, or restrict processing of your personal data,
          and to object to processing or withdraw consent. To exercise these
          rights, email{" "}
          <a className="underline" href="mailto:privacy@worksoy.com">
            privacy@worksoy.com
          </a>
          . You may also lodge a complaint with your local data protection
          authority.
        </p>
      </>
    ),
  },
  {
    heading: "International transfers",
    body: (
      <>
        <p>
          We are based in the United States and process data there and in
          locations where our service providers operate. Where required, we
          rely on Standard Contractual Clauses or other valid transfer
          mechanisms.
        </p>
      </>
    ),
  },
  {
    heading: "Security",
    body: (
      <>
        <p>
          We use industry-standard technical and organisational measures —
          encryption in transit, scoped access, audit logging, and isolated
          environments — to protect personal data. No system is perfectly
          secure; report suspected vulnerabilities to{" "}
          <a className="underline" href="mailto:security@worksoy.com">
            security@worksoy.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    heading: "Children",
    body: (
      <>
        <p>
          The Services are not directed to children under 16 and we do not
          knowingly collect personal data from them. If you believe a child
          has provided personal data, contact us so we can delete it.
        </p>
      </>
    ),
  },
  {
    heading: "Changes to this policy",
    body: (
      <>
        <p>
          We may update this policy. Material changes will be announced via
          the Services or by email. The effective date at the top of the page
          reflects the most recent revision.
        </p>
      </>
    ),
  },
  {
    heading: "Contact",
    body: (
      <>
        <p>
          Questions or requests? Email{" "}
          <a className="underline" href="mailto:privacy@worksoy.com">
            privacy@worksoy.com
          </a>
          . Postal: WorkSoy Networks, Inc., 1 Broadway, New York, NY.
        </p>
      </>
    ),
  },
];

export function PrivacyPage() {
  usePageMeta({
    title: "Privacy Policy",
    description:
      "What personal data WorkSoy collects, how we use it, and your rights — including GDPR/UK GDPR.",
    path: "/legal/privacy",
  });
  return (
    <LegalPage
      index="§ 01"
      eyebrow="Privacy Policy"
      title="What we hold, why, and your choices."
      effectiveDate="2026-04-26"
      intro={
        <>
          A short, plain-language privacy policy. We collect what we need to
          run the marketplace and keep escrow honest — nothing more.
        </>
      }
      sections={sections}
    />
  );
}
