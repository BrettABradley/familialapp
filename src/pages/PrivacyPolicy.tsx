import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Effective Date: February 27, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <p>
              Familial, LLC ("Familial," "we," "us," or "our") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Familial platform, including our website and mobile applications (collectively, the "Service"). By using the Service, you agree to the terms of this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Our Privacy Philosophy</h2>
            <p>
              Familial is built on the principle that your family's data belongs to your family — not advertisers, data brokers, or algorithms. We do not sell your data. We do not use algorithms to manipulate your feed. We do not track your behavior for advertising purposes. Your content is shared only within the private Circles you create.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <h3 className="font-semibold text-foreground mt-4">Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address</li>
              <li>Password (stored in hashed form)</li>
              <li>Display name</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Profile Information</h3>
            <p>You may optionally provide:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Profile photo</li>
              <li>Bio</li>
              <li>Location</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Content You Create</h3>
            <p>We store content you post within your Circles, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Text posts, comments, and reactions</li>
              <li>Photos and videos</li>
              <li>Events, albums, and fridge pins</li>
              <li>Messages sent to other members</li>
              <li>Family tree information</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Payment Information</h3>
            <p>
              If you subscribe to a paid plan, payment processing is handled by Stripe. We do not store your credit card number. We may receive and store your subscription status, billing history, and transaction identifiers.
            </p>

            <h3 className="font-semibold text-foreground mt-4">Automatically Collected Information</h3>
            <p>We collect minimal technical data necessary to operate the Service:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address (for security and abuse prevention)</li>
              <li>Browser type and device information</li>
              <li>Timestamps of account activity</li>
            </ul>
            <p className="mt-2 font-medium">
              We do not use tracking pixels, behavioral analytics, or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <p>We use your information solely to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Authenticate your account and ensure security</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (e.g., password resets, Circle invitations)</li>
              <li>Respond to support requests</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-2 font-medium">
              We do not use your data for targeted advertising, behavioral profiling, or algorithmic content ranking.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">4. Information Sharing & Disclosure</h2>
            <p>We do not sell, rent, or trade your personal information. We may share limited data only in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Within Your Circles:</strong> Content you post is visible to members of the Circle(s) you share it with.</li>
              <li><strong>Service Providers:</strong> We use trusted third-party services (e.g., Stripe for payments, cloud hosting providers) that process data on our behalf under strict confidentiality agreements.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or governmental request, or to protect the rights, safety, or property of Familial, our users, or the public.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Data Storage & Security</h2>
            <p>
              Your data is stored on secure, encrypted servers. We implement industry-standard security measures, including encryption in transit (TLS/SSL) and at rest, access controls, and regular security reviews.
            </p>
            <p>
              While we strive to protect your information, no method of electronic storage or transmission is 100% secure. We encourage you to use a strong, unique password for your Familial account.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Children's Privacy (COPPA Compliance)</h2>
            <p>
              Familial is designed for families, and we take children's privacy seriously. The Service is not directed at children under 13. We do not knowingly collect personal information from children under 13 without verifiable parental consent.
            </p>
            <p>
              If you are a parent or guardian and believe your child under 13 has provided us with personal information, please contact us at{" "}
              <a href="mailto:support@familialmedia.com" className="text-primary hover:underline">support@familialmedia.com</a> and we will promptly delete such information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Your Rights & Choices</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information via your Profile or Settings.</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data by contacting us.</li>
              <li><strong>Data Portability:</strong> Request an export of your data in a commonly used format.</li>
              <li><strong>Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at any time.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@familialmedia.com" className="text-primary hover:underline">support@familialmedia.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Cookies & Similar Technologies</h2>
            <p>
              We use only essential cookies required to operate the Service (e.g., session authentication). We do not use advertising cookies, social media tracking pixels, or third-party analytics that profile your behavior.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites or services. We are not responsible for the privacy practices of those third parties. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the "Effective Date" above. Your continued use of the Service after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">11. Contact Us</h2>
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
