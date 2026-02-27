import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Effective Date: February 27, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Familial platform, including our website and mobile applications (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally binding agreement between you and Familial, LLC ("Familial," "we," "us," or "our").
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              Familial is a private social networking platform designed exclusively for families. The Service allows users to create private groups ("Circles"), share posts, photos, events, messages, and other content with invited family members. Familial does not use algorithms to rank content, does not serve advertisements, and does not sell user data.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">3. Account Registration</h2>
            <p>To use the Service, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain the security of your password and account credentials</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
            </ul>
            <p className="mt-2">
              You must be at least 13 years of age to create an account. If you are under 18, you represent that you have your parent or guardian's permission to use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">4. User Content & Conduct</h2>
            <p>
              You retain ownership of all content you post on Familial ("User Content"). By posting content, you grant Familial a limited, non-exclusive license to store, display, and transmit your content solely for the purpose of operating the Service.
            </p>
            <p className="mt-2">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Post content that is illegal, abusive, threatening, harassing, defamatory, or otherwise objectionable</li>
              <li>Upload content that infringes on the intellectual property rights of others</li>
              <li>Use the Service for commercial solicitation or spam</li>
              <li>Attempt to gain unauthorized access to other accounts or systems</li>
              <li>Use automated tools to scrape, crawl, or extract data from the Service</li>
              <li>Impersonate another person or misrepresent your identity</li>
            </ul>
            <p className="mt-2">
              Familial reserves the right to remove content that violates these Terms and to suspend or terminate accounts engaged in prohibited conduct.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Circles & Privacy</h2>
            <p>
              Content shared within a Circle is visible only to members of that Circle. Circle owners control membership and may invite or remove members. By joining a Circle, you agree to respect the privacy of other members and not share Circle content outside the platform without the consent of the content creator.
            </p>
            <p className="mt-2">
              Circle owners are responsible for managing their Circle's membership and content. Familial is not responsible for disputes between Circle members.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Intellectual Property</h2>
            <p>
              The Familial name, logo, and all related trademarks, service marks, and trade dress are the property of Familial, LLC. The Service, including its design, features, and underlying technology, is protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="mt-2">
              You may not copy, modify, distribute, sell, or create derivative works based on the Service or any part thereof without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Subscriptions & Payments</h2>
            <p>
              Familial offers free and paid subscription plans. Paid plans provide additional features such as increased Circle sizes and additional Circles. Payment processing is handled by Stripe.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Billing:</strong> Subscriptions are billed on a recurring monthly or annual basis, depending on the plan selected.</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time through your account Settings. Cancellation takes effect at the end of the current billing period.</li>
              <li><strong>Refunds:</strong> Subscription fees are generally non-refundable. If you believe you are entitled to a refund, please contact us at support@familialmedia.com.</li>
              <li><strong>Price Changes:</strong> We may change subscription pricing with at least 30 days' prior notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.</li>
              <li><strong>Downgrades:</strong> If you downgrade your plan, feature limits will take effect at the start of your next billing cycle. You may need to adjust your Circles and membership to comply with the new plan's limits.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Termination</h2>
            <p>
              You may delete your account at any time by contacting us. Upon account deletion, your personal data will be removed in accordance with our Privacy Policy.
            </p>
            <p className="mt-2">
              Familial reserves the right to suspend or terminate your account at any time, with or without notice, for conduct that we determine violates these Terms, is harmful to other users, or is otherwise objectionable. If you are the owner of a Circle, other members may be offered the opportunity to claim ownership before the Circle is removed.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. FAMILIAL DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FAMILIAL, LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your use or inability to use the Service</li>
              <li>Any unauthorized access to or use of your account or data</li>
              <li>Any content or conduct of any third party on the Service</li>
              <li>Any content obtained from the Service</li>
            </ul>
            <p className="mt-2">
              IN NO EVENT SHALL FAMILIAL'S TOTAL LIABILITY EXCEED THE AMOUNT YOU HAVE PAID TO FAMILIAL IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Familial, LLC and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Service, your User Content, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">12. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Arizona, without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the Service shall be resolved exclusively in the state or federal courts located in Maricopa County, Arizona.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">13. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and updating the "Effective Date" above. Your continued use of the Service after changes constitutes acceptance of the revised Terms. If you do not agree to the updated Terms, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">14. Contact Us</h2>
            <p>If you have questions about these Terms, please contact us:</p>
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

export default TermsOfService;
