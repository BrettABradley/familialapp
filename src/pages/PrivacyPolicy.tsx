import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SEO from "@/components/shared/SEO";
import LegalPageCloseButton from "@/components/shared/LegalPageCloseButton";
import { Shield } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <SEO title="Privacy Policy - Familial" description="Read Familial's privacy policy — how we protect your family's data and respect your privacy." path="/privacy" />
      <LegalPageCloseButton />
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Effective Date: May 17, 2026</p>

        {/* Privacy-at-a-glance highlight card */}
        <div className="rounded-2xl border-2 border-foreground/10 bg-secondary/60 p-6 md:p-8 mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-foreground" />
            <h2 className="font-serif text-2xl font-semibold text-foreground m-0">Privacy at a Glance</h2>
          </div>
          <p className="text-foreground/80 mb-4">
            Familial was built as a deliberate alternative to surveillance social media. Privacy isn&rsquo;t a feature we added &mdash; it&rsquo;s the entire point.
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 list-disc pl-6 text-foreground/90 marker:text-foreground">
            <li>We don&rsquo;t sell your data. Ever.</li>
            <li>No advertising. No ad-tech. No data brokers.</li>
            <li>No behavioral tracking or third-party analytics.</li>
            <li>No algorithmic feed &mdash; posts appear chronologically.</li>
            <li>Your content is visible only inside the private Circles you choose.</li>
            <li>You can export or delete your account yourself, any time, from Settings.</li>
            <li>Encrypted in transit (TLS) and at rest.</li>
            <li>COPPA-compliant &mdash; not for children under 13.</li>
          </ul>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <p>
              Familial, LLC (&ldquo;Familial,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting the privacy of our users. This Privacy Policy explains what we collect, why we collect it, how we use and protect it, and the choices you have when you use the Familial website, iOS app, or Android app (collectively, the &ldquo;Service&rdquo;). By using the Service you agree to this policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Our Privacy Philosophy</h2>
            <p>
              Your family&rsquo;s data belongs to your family &mdash; not to advertisers, data brokers, or recommendation algorithms. We do not sell your information. We do not profile you. We do not run ads. We do not let an algorithm decide what you see. Content you post is shared only within the private Circles you create or join.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Information We Collect</h2>

            <h3 className="font-semibold text-foreground mt-4">Account Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address</li>
              <li>Password (stored only as a salted hash &mdash; we never see your plaintext password)</li>
              <li>Display name</li>
              <li>One-time codes used for two-factor authentication (2FA)</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Profile Information (Optional)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Profile photo and bio</li>
              <li>General location (free-text, never GPS)</li>
              <li>Family-tree relationships you choose to record</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Content You Create</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Text posts, comments, reactions, and direct messages</li>
              <li>Photos, videos, and voice notes</li>
              <li>Events, photo albums, and Family Fridge pins</li>
              <li>Drafts saved temporarily on your own device only</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Payment Information</h3>
            <p>
              Web subscriptions are processed by <strong>Stripe</strong>. iOS in-app subscriptions are processed by <strong>Apple</strong> through StoreKit. We never see or store your full payment card or Apple ID details &mdash; we only receive a customer identifier, subscription status, and billing history needed to manage your plan and issue receipts.
            </p>

            <h3 className="font-semibold text-foreground mt-4">Mobile Device Information</h3>
            <p>When you use the iOS or Android app, we may also collect or use:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Push notification token</strong> &mdash; an Apple/Google-issued device identifier used solely to deliver the notifications you opted into. It is deleted when you sign out, revoke notification permission, or delete your account.</li>
              <li><strong>App version, OS version, and device model</strong> &mdash; used for diagnostics and compatibility.</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address (for security, abuse prevention, and rate-limiting)</li>
              <li>Browser type</li>
              <li>Timestamps of account activity (sign-in, posts, etc.)</li>
            </ul>
            <p className="mt-2 font-medium">
              We do not use tracking pixels, behavioral analytics, fingerprinting, advertising SDKs, or third-party analytics that profile you.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">3. Mobile Device Permissions</h2>
            <p>The mobile app asks the operating system for permission before accessing any of the following. You can grant, deny, or revoke each permission at any time in your device settings.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Camera</strong> &mdash; only used when you tap to take a photo or record a video for a post, message, or profile picture.</li>
              <li><strong>Photo Library</strong> &mdash; only used when you pick existing media to attach to a post or message.</li>
              <li><strong>Microphone</strong> &mdash; only used when you record a voice note.</li>
              <li><strong>Notifications</strong> &mdash; only used for the transactional alerts described in Section 5 (new posts, comments, messages, event reminders, invitations).</li>
            </ul>
            <p>We do not access your contacts, calendar, precise location, health data, or any other sensor.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">4. How We Use Your Information</h2>
            <p>We use the information above solely to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Operate, maintain, and improve the Service</li>
              <li>Authenticate your account, including email-based 2FA</li>
              <li>Process payments, manage subscriptions, and issue receipts</li>
              <li>Send transactional emails (password resets, Circle invitations, 2FA codes, receipts, subscription notices)</li>
              <li>Deliver push notifications you have opted into</li>
              <li>Detect and prevent abuse, spam, and policy violations</li>
              <li>Honor your block, report, and account-deletion requests</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-2 font-medium">
              We do not use your data for targeted advertising, behavioral profiling, machine-learning training, or algorithmic content ranking.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Push Notifications</h2>
            <p>
              If you grant permission, we send push notifications only for activity that directly involves you: a new post in one of your Circles, a comment or reaction on your post, a new direct message, a reminder for an event you&rsquo;re attending, or an invitation to join a Circle. We never use notifications for marketing, promotions, or third-party content. You can disable notifications at any time in Settings or in your device&rsquo;s notification settings.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Content Safety &amp; Moderation</h2>
            <p>
              To keep families safe, posts, comments, and messages may be scanned automatically for prohibited content (e.g., illegal material, threats, harassment). This scan uses Google&rsquo;s Gemini API as a processor on our behalf; content is sent for the scan only and is not used to train any model, is not retained by the model provider beyond the request, and is not used for advertising. We also keep limited records of users you block and emails that have been banned for repeated abuse, used only to enforce the block.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Information Sharing &amp; Disclosure</h2>
            <p>We do not sell, rent, or trade your personal information. We share limited data only with the following categories of service providers, who process it on our behalf under contractual confidentiality and security obligations:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Members of Your Circles</strong> &mdash; content you post is visible to the Circles you share it with.</li>
              <li><strong>Cloud hosting &amp; database</strong> (Supabase) &mdash; stores your account data and media.</li>
              <li><strong>Email delivery</strong> (Resend) &mdash; sends transactional emails such as 2FA codes, invites, and receipts.</li>
              <li><strong>Payment processing</strong> (Stripe for web, Apple for iOS in-app purchases).</li>
              <li><strong>Push notification delivery</strong> (Apple Push Notification service).</li>
              <li><strong>Content-safety scanning</strong> (Google Gemini API), as described above.</li>
              <li><strong>Legal requirements</strong> &mdash; we may disclose information if required by law, court order, or governmental request, or to protect the rights, safety, or property of Familial, our users, or the public.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Data Storage &amp; Security</h2>
            <p>
              Your data is stored on secure, encrypted servers operated by our cloud provider in the United States. We use industry-standard protections including TLS for data in transit, encryption at rest, hashed passwords, row-level access controls, two-factor authentication, and rate-limited sign-in (with a temporary lockout after repeated failed attempts).
            </p>
            <p>
              While we work hard to protect your information, no system is 100% secure. Please use a strong, unique password and keep your device&rsquo;s OS up to date.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Data Retention &amp; Deletion</h2>
            <p>
              We keep your information only for as long as your account is active or as needed to provide the Service. When you delete your account from Settings, we permanently remove your profile, posts, comments, messages, media, push tokens, and other personal data within 30 days, except for a minimal record we are legally required to keep (e.g., tax records for completed transactions). Media stored in our object storage is deleted in the same operation.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">10. Children&rsquo;s Privacy (COPPA Compliance)</h2>
            <p>
              The Service is not directed at children under 13 and we do not knowingly collect personal information from children under 13 without verifiable parental consent. If you are a parent or guardian and believe your child under 13 has provided us with personal information, please contact us at{" "}
              <a href="mailto:support@familialmedia.com" className="text-primary hover:underline">support@familialmedia.com</a> and we will promptly delete that information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">11. Your Rights &amp; Choices</h2>
            <p>You can exercise the following rights at any time, most of them directly from the app:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access &amp; portability</strong> &mdash; download a complete export of your data from <em>Settings &rarr; Download My Data</em>.</li>
              <li><strong>Correction</strong> &mdash; update your profile, posts, or preferences from your Profile and Settings pages.</li>
              <li><strong>Deletion</strong> &mdash; permanently delete your account and content from <em>Settings &rarr; Delete Account</em> (three-step confirmation).</li>
              <li><strong>Block</strong> &mdash; block another user from any of their posts, comments, or messages.</li>
              <li><strong>Report</strong> &mdash; report content or another user for review.</li>
              <li><strong>Withdraw consent</strong> &mdash; revoke camera, photo-library, microphone, or notification permissions in your device settings at any time.</li>
            </ul>
            <p className="mt-2">
              California, EU/UK, and other jurisdiction-specific residents also have the right to know, correct, delete, and (where applicable) opt out of &ldquo;sharing&rdquo; for cross-context behavioral advertising &mdash; we don&rsquo;t engage in that kind of sharing at all. To exercise any right that isn&rsquo;t self-serve in the app, email{" "}
              <a href="mailto:support@familialmedia.com" className="text-primary hover:underline">support@familialmedia.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">12. Cookies &amp; Similar Technologies</h2>
            <p>
              We use only essential cookies and local storage needed to operate the Service (session authentication, your active Circle selection, unsent drafts on your device). We do not use advertising cookies, social-media tracking pixels, or third-party analytics that profile your behavior.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">13. International Users</h2>
            <p>
              Familial is operated from the United States and your information is processed in the United States. If you access the Service from outside the United States, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">14. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites. We are not responsible for the privacy practices of those third parties. Please review their privacy policies before providing any personal information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">15. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page, updating the &ldquo;Effective Date&rdquo; above, and asking you to re-accept it the next time you sign in. Continued use of the Service after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">16. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or your data, please contact us:</p>
            <div className="mt-3 space-y-1">
              <p><strong>Familial, LLC</strong></p>
              <p>
                Email:{" "}
                <a href="mailto:support@familialmedia.com" className="text-primary hover:underline">support@familialmedia.com</a>
              </p>
              <p>
                Phone:{" "}
                <a href="tel:480-648-9596" className="text-primary hover:underline">(480) 648-9596</a>
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
