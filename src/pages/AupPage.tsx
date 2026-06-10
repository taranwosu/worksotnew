import { LegalShell, LegalSection } from "@/components/LegalShell";

export function AupPage() {
  return (
    <LegalShell
      index="§ Legal · 03"
      kicker="Acceptable Use Policy"
      title="Acceptable Use Policy"
      lastUpdated="June 2026"
      intro={
        <>
          The minimum standard of conduct expected from every Client, Expert, and Admin on WorkSoy. Placeholder draft for staging — must be reviewed by counsel before go-live.
        </>
      }
    >
      <LegalSection id="purpose" title="1. Purpose">
        <p>
          WorkSoy is a marketplace for senior, consequential professional work. This policy defines behavior that is incompatible with that purpose. Violation may result in warnings, removal of content, suspension, or termination — with or without notice depending on severity.
        </p>
      </LegalSection>

      <LegalSection id="prohibited" title="2. Prohibited conduct">
        <p>You may not, directly or indirectly:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Solicit or perform any unlawful activity, including but not limited to fraud, money laundering, securities manipulation, or violations of export-control or sanctions law.</li>
          <li>Misrepresent credentials, experience, identity, or employer affiliation. Ghost-writing proposals for someone else to deliver is prohibited.</li>
          <li>Circumvent the platform fee — for example, by negotiating engagements on WorkSoy and invoicing off-platform — for the duration of an active matched engagement and for twelve (12) months after.</li>
          <li>Post discriminatory briefs or filter proposals based on protected characteristics (race, religion, gender, national origin, age, disability, sexual orientation, etc.).</li>
          <li>Upload malware, ransomware, or files designed to compromise other users or the platform.</li>
          <li>Harass, threaten, or stalk any member. Use respectful, professional language in all messages and dispute threads.</li>
          <li>Scrape the network, automate account creation, or use the platform to build a competing dataset of profiles.</li>
          <li>Submit fake reviews, ratings, or proposals. Reviews must be based on a completed engagement.</li>
          <li>Share login credentials. Each account must correspond to a single human being.</li>
          <li>Upload content that infringes any third party&rsquo;s intellectual property, privacy, or other rights.</li>
        </ul>
      </LegalSection>

      <LegalSection id="content" title="3. Content standards">
        <p>
          Briefs, proposals, profiles, messages, files, and reviews must be lawful, accurate, and your own (or properly licensed). Confidential information shared in a brief is governed by the implied NDA in our Terms — do not share it outside the engagement counterparties.
        </p>
      </LegalSection>

      <LegalSection id="payments" title="4. Payments and escrow integrity">
        <p>
          Funded milestones must be disputed in good faith on-platform — not through chargebacks. Initiating a chargeback while a dispute is open or recently resolved may result in immediate account suspension and is not a substitute for the dispute process.
        </p>
      </LegalSection>

      <LegalSection id="security" title="5. Security reporting">
        <p>
          Found a vulnerability? Email <a href="mailto:security@worksoy.com" className="underline">security@worksoy.com</a> with a description and steps to reproduce. Do not test against accounts you do not own. We will acknowledge within three business days.
        </p>
      </LegalSection>

      <LegalSection id="enforcement" title="6. Enforcement">
        <p>
          Violations are reviewed by WorkSoy admins. Enforcement actions can include content removal, profile delisting, suspension, permanent termination, and forfeiture of in-progress payouts pending dispute resolution. We may also report unlawful conduct to law enforcement.
        </p>
      </LegalSection>

      <LegalSection id="reporting" title="7. Report a violation">
        <p>
          See something off? Email <a href="mailto:trust@worksoy.com" className="underline">trust@worksoy.com</a> with context and any relevant message or brief IDs.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
