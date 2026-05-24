/**
 * Privacy Policy.
 *
 * Written to match what the app actually does. Don't make this generic —
 * Google OAuth verification reviewers will compare the language to the data
 * flows in the OAuth scopes and Stripe integration. Misalignment = rejection.
 *
 * Source of truth for data flows:
 *   - Photos: device-local (browser localStorage, never uploaded). See Home.tsx.
 *   - Account / AI memory: Supabase (Postgres + RLS). See aiProfileSync.ts.
 *   - AI calls: Anthropic Claude (image bytes + text). See server/aiSuggest.ts.
 *   - Payments: Stripe Checkout (we never touch card numbers). See stripe-checkout.ts.
 *   - Errors: Sentry (no PII; sendDefaultPii: false). See instrument.ts.
 *   - Rate limits: Upstash Redis (IP + user_id, transient). See rateLimit.ts.
 */
import LegalLayout, { H2, P, Strong, UL, LI, A } from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="May 23, 2026">
      <P>
        Dumpster is a tool for sequencing Instagram photo carousels. We want it
        to be useful without becoming another data-vacuum. This page describes
        exactly what we collect, why, where it lives, and how to delete it.
      </P>

      <H2>The TL;DR</H2>
      <UL>
        <LI><Strong>Your photos stay on your device.</Strong> We don't upload them to any
          server you don't trigger. They live in your browser's local storage.</LI>
        <LI><Strong>Your AI preferences sync to your account.</Strong> Taste profile, rules,
          and saved captions are stored in our database (Supabase) so they survive
          across devices.</LI>
        <LI><Strong>AI features send photos to Anthropic.</Strong> When you tap AI Suggest,
          AI Caption, or Valet (AI Chat), the relevant images and text go to
          Anthropic's Claude API. Anthropic does not train on this data per
          their API terms.</LI>
        <LI><Strong>Payments go to Stripe.</Strong> We never see your card number.</LI>
        <LI><Strong>You can delete everything.</Strong> Email us and your account + all data
          are gone within 7 days.</LI>
      </UL>

      <H2>What we collect</H2>

      <H2>1. Account information</H2>
      <P>
        When you sign in with Google, we receive your <Strong>email address</Strong> and
        <Strong> display name</Strong>. We use this to identify your account and to
        contact you about service issues. We do not receive your Google password,
        contacts, drive files, or any other Google data.
      </P>

      <H2>2. AI personalization</H2>
      <P>
        To make AI features useful, we store:
      </P>
      <UL>
        <LI>Your written <Strong>taste profile</Strong> (the aesthetic description you provide)</LI>
        <LI>Your <Strong>AI rules</Strong> (constraints you want the AI to follow)</LI>
        <LI>Your <Strong>caption library</Strong> with favorited and banned flags</LI>
      </UL>
      <P>
        This data is stored in our Supabase Postgres database with row-level
        security — only you (authenticated as your account) can read or write
        your row. It is sent with every AI request so Claude can match your
        voice. Total size for a typical user: under 50 KB.
      </P>

      <H2>3. Photos and videos</H2>
      <P>
        Photos you upload <Strong>stay on your device</Strong>. They are stored in your
        browser's local storage as compressed data URLs. When you use an AI
        feature, the photos for that one request are sent to Anthropic Claude
        for analysis and then discarded — they are not stored on our servers.
      </P>
      <P>
        If you use the "Save to Photos" feature on iOS, the file goes from your
        browser to your camera roll via the system share sheet. We never see it.
      </P>

      <H2>4. Payment information</H2>
      <P>
        Subscriptions and credit packs are processed by <A href="https://stripe.com/privacy">Stripe</A>.
        We receive only a customer ID and the high-level status of your
        subscription (free, pro, lifetime). Stripe holds your card details.
      </P>

      <H2>5. Usage and rate limiting</H2>
      <P>
        We log the count of AI requests per user per time window in
        <A href="https://upstash.com/trust/privacy"> Upstash Redis </A>
        to enforce per-user rate limits and a global daily spending cap. These
        records contain your user ID and IP address; they auto-expire after the
        rate-limit window passes (typically 10 minutes to 36 hours).
      </P>

      <H2>6. Error tracking</H2>
      <P>
        We use <A href="https://sentry.io/privacy">Sentry</A> to capture
        application errors so we can fix them. PII reporting is disabled
        (<code style={{ background: "#1a1a1a", padding: "1px 6px", borderRadius: 3, fontSize: 13 }}>sendDefaultPii: false</code>).
        Sentry receives stack traces, browser version, and the URL where the
        error happened — not your photos, account, or AI memory.
      </P>

      <H2>How we use this information</H2>
      <UL>
        <LI>To provide the AI features (sending your photos and prefs to Claude
          on each request)</LI>
        <LI>To process payments and manage your subscription</LI>
        <LI>To prevent abuse via rate limiting and budget caps</LI>
        <LI>To diagnose bugs via error tracking</LI>
        <LI>To send you essential service emails (password resets, payment
          receipts, security notices) — we do not send marketing emails</LI>
      </UL>

      <H2>Third-party processors</H2>
      <P>The services we send data to, and what they get:</P>
      <UL>
        <LI><Strong>Anthropic</Strong> — photos and taste profile per AI request. Governed
          by the <A href="https://www.anthropic.com/legal/commercial-terms">Anthropic Commercial Terms</A>. Per those terms, Anthropic does not use API
          inputs/outputs to train their models.</LI>
        <LI><Strong>Supabase</Strong> — account email, AI memory, subscription status.
          <A href="https://supabase.com/privacy"> Supabase Privacy Policy</A>.</LI>
        <LI><Strong>Stripe</Strong> — payment details. <A href="https://stripe.com/privacy">Stripe Privacy Policy</A>.</LI>
        <LI><Strong>Vercel</Strong> — hosts the application; sees request metadata in
          server logs. <A href="https://vercel.com/legal/privacy-policy">Vercel Privacy Policy</A>.</LI>
        <LI><Strong>Upstash</Strong> — rate-limit counters tied to your user ID and IP.
          <A href="https://upstash.com/trust/privacy"> Upstash Privacy Policy</A>.</LI>
        <LI><Strong>Sentry</Strong> — error reports (no PII). <A href="https://sentry.io/privacy">Sentry Privacy Policy</A>.</LI>
        <LI><Strong>Google</Strong> — OAuth sign-in. <A href="https://policies.google.com/privacy">Google Privacy Policy</A>.</LI>
      </UL>

      <H2>Data retention</H2>
      <UL>
        <LI>Account email and AI memory: kept until you delete your account.</LI>
        <LI>Photos: stored only in your browser; you control them. Clear your
          browser data to remove them.</LI>
        <LI>Rate-limit counters: 10 minutes to 36 hours, then auto-deleted.</LI>
        <LI>Payment records: kept as long as required by tax and accounting law
          (Stripe handles this directly).</LI>
        <LI>Error reports: 90 days, then auto-purged by Sentry.</LI>
      </UL>

      <H2>Your rights</H2>
      <P>
        You can:
      </P>
      <UL>
        <LI><Strong>Access</Strong> the data we have on you (email us and we'll export your row).</LI>
        <LI><Strong>Correct</Strong> your taste profile, rules, and captions inside the app at
          any time.</LI>
        <LI><Strong>Delete</Strong> your entire account and all AI memory by emailing us. We
          honor deletion requests within 7 days.</LI>
        <LI><Strong>Cancel</Strong> your subscription at any time from the Credits menu inside
          the app.</LI>
      </UL>
      <P>
        If you're in the EU, UK, or California, the regional privacy laws
        (GDPR, UK GDPR, CCPA) give you additional rights to portability and
        objection. To exercise any of these, email
        <A href="mailto:leescott2019@gmail.com"> leescott2019@gmail.com</A>.
      </P>

      <H2>Children</H2>
      <P>
        Dumpster is not directed at children under 13. We do not knowingly
        collect data from anyone under 13. If you believe a child has signed
        up, email us and we will delete the account.
      </P>

      <H2>Changes</H2>
      <P>
        If we make a material change to this policy, we'll update the "last
        updated" date above and, if you have an account, send a one-time
        notice to your account email.
      </P>

      <H2>Contact</H2>
      <P>
        Questions, deletion requests, or anything else:
        <A href="mailto:leescott2019@gmail.com"> leescott2019@gmail.com</A>.
      </P>
    </LegalLayout>
  );
}
