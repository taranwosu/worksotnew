import { LegalShell, LegalSection } from "@/components/LegalShell";

export function PrivacyPage() {
  return (
    <LegalShell
      index="§ Legal · 02"
      kicker="Privacy Policy"
      title="Privacy Policy"
      lastUpdated="June 2026"
      intro={
        <>
          How WorkSoy Networks, Inc. handles your information. Placeholder draft for staging — must be reviewed by privacy counsel before go-live, especially for jurisdictions
          covered by GDPR (EU/UK), CCPA/CPRA (California), LGPD (Brazil), and similar regimes.
        </>
      }
    >
      <LegalSection id="overview" title="1. Overview">
        <p>
          We collect the minimum information required to run an introductions and contracting marketplace for senior professionals. We do not sell your personal data. We never use member messages to train third-party models.
        </p>
      </LegalSection>

      <LegalSection id="data" title="2. What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Identity:</strong> name, email, role (Client/Expert/Admin), and a profile photo URL you provide.</li>
          <li><strong>Authentication:</strong> hashed password (bcrypt) or an OAuth identifier from Emergent Google Sign-In.</li>
          <li><strong>Professional profile (Experts):</strong> headline, category, specialties, hourly rate, location, years of experience, bio, languages, certifications.</li>
          <li><strong>Engagement data:</strong> briefs, proposals, contracts, milestones, messages, files uploaded as evidence, reviews and ratings.</li>
          <li><strong>Payments:</strong> Stripe handles cards directly. We store transaction IDs, amounts, and status only — we do not store card numbers.</li>
          <li><strong>Operational:</strong> IP address, user agent, and log timestamps for security and abuse prevention.</li>
        </ul>
      </LegalSection>

      <LegalSection id="uses" title="3. How we use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>To provide the service: matching, contracting, escrow, messaging, dispute resolution, notifications.</li>
          <li>To verify Expert credentials during vetting and to display public profiles in the network.</li>
          <li>To process payments and issue tax forms where required.</li>
          <li>To detect, investigate, and prevent abuse, fraud, and security incidents.</li>
          <li>To improve the product (aggregated, de-identified analytics).</li>
        </ul>
      </LegalSection>

      <LegalSection id="sharing" title="4. Who we share it with">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Counterparties on the same contract:</strong> e.g. the Client sees the Expert&rsquo;s profile, proposal, messages; vice versa.</li>
          <li><strong>WorkSoy admins:</strong> for vetting, dispute resolution, and platform integrity.</li>
          <li><strong>Sub-processors:</strong> Stripe (payments), our infrastructure provider (hosting), and an email-delivery vendor (when wired). Each is bound by data-processing terms.</li>
          <li><strong>Legal compliance:</strong> when required by law, subpoena, or to protect rights, safety, or property.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell or rent your personal data. We do <strong>not</strong> share content of messages with advertising networks.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="5. Retention">
        <p>
          We retain account and engagement data for as long as your account is active and for a reasonable period after closure to satisfy legal, tax, and audit requirements (typically up to seven years for financial records). Files uploaded as dispute evidence are retained for the lifetime of the related dispute plus four years.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="6. Your rights">
        <p>
          Depending on your jurisdiction, you may have the right to access, correct, delete, restrict, or port your personal data, and to object to certain processing. Email{" "}
          <a href="mailto:privacy@worksoy.com" className="underline">privacy@worksoy.com</a> to exercise any of these rights. We will respond within the timeframe required by applicable law.
        </p>
        <p>
          EU/UK users may lodge a complaint with their supervisory authority. California users may designate an authorized agent to make requests on their behalf.
        </p>
      </LegalSection>

      <LegalSection id="security" title="7. Security">
        <p>
          Passwords are stored hashed (bcrypt). Sessions use HTTP-only cookies. File uploads are scope-authorized so only counterparties on the same contract or dispute thread can access them. We log security-relevant events and run regular reviews of access patterns.
        </p>
      </LegalSection>

      <LegalSection id="children" title="8. Children">
        <p>
          The service is not intended for individuals under 18. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes to this policy">
        <p>
          We&rsquo;ll announce material changes in-product and/or by email at least 14 days before they take effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="10. Contact">
        <p>
          Privacy inquiries: <a href="mailto:privacy@worksoy.com" className="underline">privacy@worksoy.com</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
