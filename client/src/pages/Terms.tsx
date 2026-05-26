/**
 * Terms of Service.
 *
 * Plain-English, beta-friendly, but covers the substantive bases:
 *   - Account / acceptable use
 *   - IP ownership (your photos are yours; you grant a narrow processing license)
 *   - Subscriptions, refunds, cancellation
 *   - AI output disclaimers (Claude isn't deterministic, captions aren't legal advice)
 *   - Limitation of liability
 *   - Governing law
 *
 * Not a substitute for an attorney's review before a public launch.
 */
import LegalLayout, { H2, P, Strong, UL, LI, A } from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="May 23, 2026">
      <P>
        By using Dumpster you agree to these terms. They're written in plain
        English. If something's unclear, email
        <A href="mailto:leescott2019@gmail.com"> leescott2019@gmail.com</A>.
      </P>

      <H2>1. Who can use Dumpster</H2>
      <P>
        You need to be at least 13 years old. If you're under 18, your parent
        or guardian agrees to these terms on your behalf. You're responsible
        for keeping your account credentials secure — anything done with your
        account is your responsibility.
      </P>

      <H2>2. Your content stays yours</H2>
      <P>
        The photos, videos, captions, and dump arrangements you create remain
        <Strong> entirely yours</Strong>. We don't claim ownership.
      </P>
      <P>
        To make the app work, you grant us a narrow, temporary license to
        process your content for the specific feature you triggered — for
        example, sending a photo to Anthropic Claude when you tap Auto Gen.
        This license ends when the request completes. We do not use your
        content to train AI models, run ads, or sell to third parties.
      </P>

      <H2>3. Acceptable use</H2>
      <P>Don't use Dumpster to:</P>
      <UL>
        <LI>Upload content that infringes someone else's copyright, trademark,
          or right of publicity.</LI>
        <LI>Upload CSAM, non-consensual intimate imagery, or content that
          sexualizes minors.</LI>
        <LI>Upload content depicting credible threats of violence, terrorism,
          or content that incites violence against a person or group.</LI>
        <LI>Attempt to reverse-engineer, scrape, abuse, or overwhelm the
          service (including circumventing rate limits or credit limits).</LI>
        <LI>Use the AI features to generate captions or content that's
          illegal, defamatory, or harassing.</LI>
        <LI>Resell access to your Dumpster account or pool of credits.</LI>
      </UL>
      <P>
        We reserve the right to suspend or terminate accounts that violate
        these rules. For egregious violations (CSAM, credible threats) we may
        report to law enforcement.
      </P>

      <H2>4. Subscriptions, credits, and refunds</H2>
      <UL>
        <LI><Strong>Free tier</Strong> — every account gets a daily credit allowance for
          AI features.</LI>
        <LI><Strong>Pro subscriptions</Strong> — billed monthly or annually via Stripe.
          You can cancel any time from the Credits menu inside the app or
          from your Stripe customer portal. Cancellation takes effect at the
          end of the current billing period; we do not pro-rate refunds for
          partial periods.</LI>
        <LI><Strong>Lifetime purchase</Strong> — one-time payment, no refunds after the
          first 7 days. Lifetime = the lifetime of the Dumpster service. If
          we shut Dumpster down, lifetime users are not entitled to a refund
          beyond the 7-day window.</LI>
        <LI><Strong>Credit packs</Strong> — one-time purchases. Credits don't expire while
          your account is active. Not refundable once consumed.</LI>
        <LI><Strong>Bug-related credit loss</Strong> — if a Dumpster bug consumes credits
          you didn't intend to spend (e.g., a failed AI request that still
          deducted), email us and we'll refund the credits.</LI>
      </UL>
      <P>
        We may change pricing for future subscription periods with 30 days'
        notice via email. Your existing subscription continues at the price
        you signed up at until the next renewal.
      </P>

      <H2>5. AI output disclaimers</H2>
      <P>
        Dumpster uses Anthropic Claude for photo clustering, caption
        generation, and the Valet chat assistant. AI output is
        <Strong> probabilistic</Strong>, not deterministic — the same input may produce
        different output on different runs.
      </P>
      <UL>
        <LI>AI-generated captions are <Strong>suggestions</Strong>. Review them before
          posting publicly. We're not responsible for content you choose to
          publish based on AI suggestions.</LI>
        <LI>AI photo clustering is a tool, not a judgment of taste. You're
          the final editor.</LI>
        <LI>Nothing the AI says constitutes legal, medical, financial, or
          professional advice.</LI>
      </UL>

      <H2>6. Service availability</H2>
      <P>
        Dumpster is provided "as is" and "as available." We make a good-faith
        effort to keep it running, but we don't guarantee uptime. We may
        introduce daily spending caps on AI features that, if hit, temporarily
        disable those features to protect the service.
      </P>
      <P>
        We may modify, suspend, or discontinue features (or the entire
        service) at any time. If we discontinue a paid feature you're
        subscribed to, we'll pro-rate a refund.
      </P>

      <H2>7. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, Dumpster's total liability to
        you for any claim arising out of or relating to the service is limited
        to the amount you paid us in the 12 months before the claim arose, or
        $50, whichever is greater.
      </P>
      <P>
        We are not liable for indirect, incidental, consequential, or
        punitive damages, including lost profits, lost data (your photos are
        local — back them up), or business interruption.
      </P>

      <H2>8. Indemnification</H2>
      <P>
        If a third party sues us because of content you uploaded or because
        you violated these terms, you agree to defend and indemnify us
        against that claim, including reasonable legal fees.
      </P>

      <H2>9. Account termination</H2>
      <P>
        You can delete your account at any time by emailing
        <A href="mailto:leescott2019@gmail.com"> leescott2019@gmail.com</A>.
        We honor deletion within 7 days. We may terminate accounts that
        violate the Acceptable Use rules, with notice when possible.
      </P>

      <H2>10. Governing law and disputes</H2>
      <P>
        These terms are governed by the laws of the State of New York, USA,
        without regard to conflict-of-law principles. Disputes will be
        resolved in the state or federal courts located in New York County,
        NY, and you consent to personal jurisdiction there.
      </P>
      <P>
        Nothing in this section limits your rights as a consumer under
        applicable mandatory local law (e.g., EU consumer protections).
      </P>

      <H2>11. Changes to these terms</H2>
      <P>
        If we make a material change, we'll update the "last updated" date
        above and notify you by email. Continued use of Dumpster after a
        change means you accept the new terms. If you don't agree, stop
        using the service and email us to delete your account.
      </P>

      <H2>12. Contact</H2>
      <P>
        Questions or concerns:
        <A href="mailto:leescott2019@gmail.com"> leescott2019@gmail.com</A>.
      </P>
    </LegalLayout>
  );
}
