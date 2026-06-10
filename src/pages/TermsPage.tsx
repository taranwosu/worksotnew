import { LegalShell, LegalSection } from "@/components/LegalShell";

export function TermsPage() {
  return (
    <LegalShell
      index="§ Legal · 01"
      kicker="Terms of Service"
      title="Terms of Service"
      lastUpdated="June 2026"
      intro={
        <>
          These terms govern your use of WorkSoy Networks, Inc. (&ldquo;WorkSoy,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). This is a placeholder draft for staging.
          Before go-live this document must be reviewed and signed off by qualified counsel licensed in your operating jurisdictions.
        </>
      }
    >
      <LegalSection id="acceptance" title="1. Acceptance of these terms">
        <p>
          By creating an account, posting a brief, applying to a brief, or otherwise accessing the WorkSoy platform you agree to these Terms of Service, the
          Privacy Policy, and the Acceptable Use Policy. If you do not agree, do not use the service.
        </p>
        <p>
          You represent that you are at least 18 years old and have the authority to bind the entity you represent (if any) to these terms.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="2. Accounts and verification">
        <p>
          Accounts are role-tagged as <em>Client</em>, <em>Expert</em>, or <em>Admin</em>. Experts undergo a vetting review before being listed in the public network.
          Maintaining accurate professional information (rates, certifications, employer disclosures) is a continuing obligation.
        </p>
        <p>
          You are responsible for all activity under your account and for keeping credentials secure. Notify us immediately of any suspected unauthorized access.
        </p>
      </LegalSection>

      <LegalSection id="engagements" title="3. Briefs, proposals, and engagements">
        <p>
          WorkSoy is a contracting platform — not the employer of any Expert and not the agent of any Client. Engagements are direct contracts between Client and Expert.
          The platform facilitates introduction, contracting, milestone tracking, escrow, and dispute mediation.
        </p>
        <p>
          The SOW you counter-sign on WorkSoy controls scope, deliverables, and rates. Side agreements that contradict the on-platform SOW are not supported by escrow or dispute resolution.
        </p>
      </LegalSection>

      <LegalSection id="payments" title="4. Payments and escrow">
        <p>
          Milestones are funded into escrow via our payment processor (currently Stripe). Funds are released to the Expert only when the Client marks the milestone released
          or when an admin resolves a dispute in the Expert&rsquo;s favor. WorkSoy charges a platform fee — disclosed at funding time — which is deducted at payout.
        </p>
        <p>
          You agree to comply with all tax obligations in your jurisdiction. WorkSoy may issue tax forms (e.g. 1099-NEC in the United States) where required by law.
        </p>
      </LegalSection>

      <LegalSection id="disputes" title="5. Disputes">
        <p>
          A milestone that is funded or submitted may be disputed by either party. Filing a dispute pauses release of those funds until an admin resolves it. The dispute thread
          and any uploaded evidence are visible to the Client, the Expert, and the admin assigned to the case. Resolution is at admin discretion, guided by the on-platform SOW.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="6. Intellectual property">
        <p>
          Unless the SOW expressly assigns rights to the Client on acceptance, Experts retain ownership of pre-existing IP and grant a non-exclusive license to use deliverables for the contracted purpose.
          Final assignment of work-product IP follows the SOW.
        </p>
        <p>
          WorkSoy retains all rights to the platform itself, including UI, copy, brand marks, and product code. Reviews submitted on the platform are licensed to WorkSoy on a perpetual, royalty-free basis for the purpose of operating and improving the marketplace.
        </p>
      </LegalSection>

      <LegalSection id="content" title="7. Your content">
        <p>
          You retain ownership of content you upload (briefs, proposals, messages, files, reviews). You grant WorkSoy a worldwide, non-exclusive license to host, display, and process that content for the purpose of providing the service.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="8. Suspension and termination">
        <p>
          We may suspend or terminate accounts that violate these Terms, the Acceptable Use Policy, or applicable law. Active contracts remain in effect at the moment of suspension and are subject to dispute resolution as needed.
        </p>
      </LegalSection>

      <LegalSection id="warranties" title="9. Disclaimers; limitation of liability">
        <p>
          The platform is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
          To the maximum extent permitted by law, WorkSoy&rsquo;s aggregate liability arising out of or relating to these Terms will not exceed the platform fees you paid to WorkSoy in the twelve months preceding the claim.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="10. Changes to these terms">
        <p>
          We may update these Terms from time to time. Material changes will be announced via in-product notification and/or email at least 14 days before they take effect. Continued use after the effective date constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contact">
        <p>
          Questions about these Terms: <a href="mailto:legal@worksoy.com" className="underline">legal@worksoy.com</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
