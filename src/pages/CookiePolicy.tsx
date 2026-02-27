import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground mb-10">Effective Date: February 27, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <p>
              This Cookie Policy explains how Familial, LLC ("Familial," "we," "us," or "our") uses cookies and similar technologies on the Familial platform, including our website and mobile applications (collectively, the "Service"). This policy should be read alongside our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Our Approach to Cookies</h2>
            <p>
              Familial is built on a privacy-first philosophy. Unlike most social platforms, we do not use cookies for advertising, behavioral tracking, or profiling. We use only the minimum cookies necessary to operate the Service securely and reliably.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">2. What Are Cookies?</h2>
            <p>
              Cookies are small text files placed on your device by a website or application. They are widely used to make websites work efficiently, provide security features, and give site owners useful information. Similar technologies include local storage and session storage in your browser.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">3. Cookies We Use</h2>
            <p>We use only <strong>strictly necessary cookies</strong> — those required for the Service to function. These include:</p>

            <h3 className="font-semibold text-foreground mt-4">Authentication Cookies</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Purpose:</strong> To keep you signed in to your account and maintain your session</li>
              <li><strong>Duration:</strong> Session-based; cleared when you sign out or your session expires</li>
              <li><strong>Type:</strong> First-party, essential</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Security Cookies</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Purpose:</strong> To protect against cross-site request forgery (CSRF) and other security threats</li>
              <li><strong>Duration:</strong> Session-based</li>
              <li><strong>Type:</strong> First-party, essential</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-4">Preference Cookies</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Purpose:</strong> To remember your display preferences such as theme (light/dark mode) and selected Circle</li>
              <li><strong>Duration:</strong> Persistent until cleared</li>
              <li><strong>Type:</strong> First-party, essential</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">4. Cookies We Do NOT Use</h2>
            <p>Familial does not use:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Advertising or targeting cookies</strong> — We do not serve ads or track you for advertising purposes</li>
              <li><strong>Third-party analytics cookies</strong> — We do not use Google Analytics, Facebook Pixel, or similar tracking tools</li>
              <li><strong>Social media tracking cookies</strong> — We do not embed social media widgets that track your browsing activity</li>
              <li><strong>Cross-site tracking cookies</strong> — We do not track your activity across other websites</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Third-Party Services</h2>
            <p>
              We use Stripe to process payments for paid subscriptions. When you interact with the Stripe payment interface, Stripe may set its own cookies to process your payment securely and prevent fraud. These cookies are governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Privacy Policy</a>.
            </p>
            <p className="mt-2">
              We do not control the cookies set by Stripe and recommend reviewing their privacy policy for more information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Managing Cookies</h2>
            <p>
              Since we only use essential cookies, disabling them may prevent the Service from functioning correctly — for example, you may not be able to stay signed in to your account.
            </p>
            <p className="mt-2">You can manage cookies through your browser settings. Most browsers allow you to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>View what cookies are stored on your device</li>
              <li>Delete individual or all cookies</li>
              <li>Block cookies from specific or all websites</li>
              <li>Set preferences for first-party vs. third-party cookies</li>
            </ul>
            <p className="mt-2">
              Please note that because Familial only uses essential cookies, we do not display a cookie consent banner. Under applicable privacy regulations, strictly necessary cookies are exempt from consent requirements.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Local Storage & Session Storage</h2>
            <p>
              In addition to cookies, we may use your browser's local storage and session storage to maintain your authentication state and application preferences. These function similarly to cookies but are accessed only by the Familial application and are not sent with HTTP requests.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. We will notify you of material changes by updating the "Effective Date" above. Your continued use of the Service after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Contact Us</h2>
            <p>If you have questions about this Cookie Policy, please contact us:</p>
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

export default CookiePolicy;
