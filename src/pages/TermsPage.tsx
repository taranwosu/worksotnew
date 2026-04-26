import { LegalPage, type LegalSection } from "./LegalPage";
import { usePageMeta } from "@/lib/seo";

const sections: LegalSection[] = [
  {
    heading: "Acceptance of these terms",
    body: (
      <>
        <p>
          These Terms of Service (the &ldquo;Terms&rdquo;) form a binding
          agreement between you and WorkSoy Networks, Inc. (&ldquo;WorkSoy&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;). They govern your access to the
          WorkSoy website, application, and related services (the
          &ldquo;Services&rdquo;).
        </p>
        <p>
          By creating an account, posting a brief, submitting a proposal, or
          otherwise using the Services, you confirm that you have read,
          understood, and agreed to these Terms. If you do not agree, do not use
          the Services.
        </p>
      </>
    ),
  },
  {
    heading: "Who can use the Services",
    body: (
      <>
        <p>
          You must be at least 18 years old and capable of entering into a
          binding contract in your jurisdiction. If you use the Services on
          behalf of a company or organisation, you represent that you have
          authority to bind that entity to these Terms.
        </p>
      </>
    ),
  },
  {
    heading: "Accounts and security",
    body: (
      <>
        <p>
          You are responsible for the activity that happens under your account
          and for keeping your credentials confidential. Notify us promptly at
          security@worksoy.com if you suspect unauthorised access.
        </p>
        <p>
          We may suspend or terminate accounts that violate these Terms, abuse
          the Services, or expose other users to risk.
        </p>
      </>
    ),
  },
  {
    heading: "Roles: clients and experts",
    body: (
      <>
        <p>
          <strong>Clients</strong> post briefs, review proposals, fund milestones
          via Stripe-held escrow, approve work, and release funds.
        </p>
        <p>
          <strong>Experts</strong> are independent contractors who submit
          proposals, deliver work against agreed milestones, and receive
          payment when work is accepted.
        </p>
        <p>
          WorkSoy is not a party to the engagement between a client and an
          expert. We provide the platform, escrow, and dispute infrastructure;
          the contractual relationship for the work itself is between the
          client and the expert.
        </p>
      </>
    ),
  },
  {
    heading: "Payments, escrow, and fees",
    body: (
      <>
        <p>
          Payments are processed by Stripe. Funds for fixed-price milestones are
          held in escrow until the client approves the work or a dispute is
          resolved.
        </p>
        <p>
          WorkSoy charges a service fee disclosed at the time of contract
          creation. Refunds, chargebacks, and currency conversion are subject to
          Stripe&rsquo;s terms and applicable law.
        </p>
      </>
    ),
  },
  {
    heading: "Acceptable use",
    body: (
      <>
        <p>You agree not to use the Services to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>break the law, infringe rights, or evade sanctions;</li>
          <li>misrepresent your identity, credentials, or availability;</li>
          <li>attempt to bypass escrow, fees, or matchmaking;</li>
          <li>upload malware, scrape data, or interfere with the Services;</li>
          <li>harass other users or our team.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Intellectual property",
    body: (
      <>
        <p>
          You retain ownership of the content you upload. By submitting content
          you grant WorkSoy a non-exclusive licence to host, display, and
          process it as needed to operate the Services.
        </p>
        <p>
          The WorkSoy brand, software, and platform content are owned by us and
          our licensors and may not be copied or redistributed without
          permission.
        </p>
      </>
    ),
  },
  {
    heading: "Disputes between users",
    body: (
      <>
        <p>
          If a milestone cannot be resolved between client and expert, either
          party may raise a dispute. WorkSoy operations review the contract,
          deliverables, and messages and decide whether to release escrow,
          refund, or split funds. Decisions are final for the platform but do
          not waive your statutory rights.
        </p>
      </>
    ),
  },
  {
    heading: "Disclaimer and liability",
    body: (
      <>
        <p>
          The Services are provided &ldquo;as is&rdquo; without warranties of any
          kind. To the fullest extent permitted by law, WorkSoy is not liable
          for indirect, incidental, or consequential damages, and our aggregate
          liability is limited to the fees you paid us in the twelve months
          preceding the claim.
        </p>
      </>
    ),
  },
  {
    heading: "Termination",
    body: (
      <>
        <p>
          You may close your account at any time. We may suspend or close
          accounts for breach, fraud, or risk reasons. Sections that by their
          nature should survive (payment, IP, liability) survive termination.
        </p>
      </>
    ),
  },
  {
    heading: "Changes to these Terms",
    body: (
      <>
        <p>
          We may update these Terms. Material changes will be announced via the
          Services or by email. Continued use after the effective date of an
          update constitutes acceptance.
        </p>
      </>
    ),
  },
  {
    heading: "Governing law",
    body: (
      <>
        <p>
          These Terms are governed by the laws of the State of Delaware, without
          regard to conflict-of-laws principles. Disputes will be resolved in
          the state or federal courts located in Delaware, unless local law
          requires otherwise.
        </p>
      </>
    ),
  },
  {
    heading: "Contact",
    body: (
      <>
        <p>
          Questions about these Terms? Email{" "}
          <a className="underline" href="mailto:legal@worksoy.com">
            legal@worksoy.com
          </a>
          .
        </p>
      </>
    ),
  },
];

export function TermsPage() {
  usePageMeta({
    title: "Terms of Service",
    description:
      "The terms governing your use of WorkSoy — accounts, payments, escrow, disputes, and IP.",
    path: "/legal/terms",
  });
  return (
    <LegalPage
      index="§ 01"
      eyebrow="Terms of Service"
      title="The terms we work by."
      effectiveDate="2026-04-26"
      intro={
        <>
          A plain-language version of how WorkSoy operates as a marketplace,
          what we&rsquo;re responsible for, and what we ask of you.
        </>
      }
      sections={sections}
    />
  );
}
