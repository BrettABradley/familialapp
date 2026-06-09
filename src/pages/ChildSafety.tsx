import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SEO from "@/components/shared/SEO";

const ChildSafety = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Child Safety Standards - Familial"
        description="Familial's zero-tolerance policy on child sexual abuse and exploitation (CSAE/CSAM), our prevention practices, reporting tools, and contact for child safety concerns."
        path="/child-safety"
      />
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
          Child Safety Standards
        </h1>
        <p className="text-muted-foreground mb-10">Effective Date: June 9, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <p>
              Familial, LLC ("Familial," "we," "us," or "our") operates a private,
              invitation-only family social network. We have a zero-tolerance policy toward
              child sexual abuse and exploitation (CSAE) and child sexual abuse material
              (CSAM). This page describes our published standards, prevention practices,
              in-app reporting tools, and how to contact us about child safety concerns,
              in compliance with Google Play's Child Safety Standards Policy and Apple's
              App Store Review Guidelines.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              1. Zero-Tolerance Policy
            </h2>
            <p>
              Familial strictly prohibits any content, conduct, or communication that
              sexually exploits, abuses, or endangers children. This includes, without
              limitation:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Child sexual abuse material (CSAM) in any form — images, video, audio, drawings, or text</li>
              <li>Grooming, sexual solicitation, or sextortion of a minor</li>
              <li>Sharing of nude, sexualized, or suggestive imagery of minors</li>
              <li>Trafficking, sale, or exploitation of minors</li>
              <li>Promoting, glorifying, or providing instructions for any of the above</li>
            </ul>
            <p className="mt-2">
              Any account found to engage in this conduct is permanently banned, the
              content is removed, and we report to the National Center for Missing &
              Exploited Children (NCMEC) and cooperate with law enforcement as required
              by 18 U.S.C. § 2258A.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              2. Minimum Age
            </h2>
            <p>
              Familial is intended for users aged 13 and older, in compliance with the
              Children's Online Privacy Protection Act (COPPA). Users under 13 are not
              permitted to create accounts. If we learn that we have collected information
              from a child under 13, we will delete the account and associated data
              promptly. Parents and guardians who believe their child has created an
              account may contact us at the email below for immediate removal.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              3. Prevention Practices
            </h2>
            <p>We use a layered approach to prevent CSAE/CSAM on the Service:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Invitation-only architecture.</strong> Familial is a private
                network. Users only share content inside Circles they have been invited
                to by another verified member. There is no public feed, no public
                discovery, no stranger-to-stranger messaging, and no algorithmic
                amplification.
              </li>
              <li>
                <strong>Automated content scanning.</strong> All uploaded images and
                videos are scanned asynchronously by a multimodal AI model
                (Google Gemini 2.5 Flash) for nudity, sexual content, child endangerment,
                and other policy violations. Content that triggers a violation is
                quarantined for human review.
              </li>
              <li>
                <strong>Human moderation.</strong> Flagged content and user reports are
                reviewed by Familial's trust and safety team at{" "}
                <a
                  href="mailto:support@familialmedia.com"
                  className="text-primary hover:underline"
                >
                  support@familialmedia.com
                </a>
                . Confirmed CSAM is preserved as required by law, reported to NCMEC's
                CyberTipline, and the offending account is permanently terminated.
              </li>
              <li>
                <strong>Account-level enforcement.</strong> Banned users have their email
                address added to our banned list to prevent re-registration, and we block
                duplicate device signals where available.
              </li>
              <li>
                <strong>No anonymous accounts.</strong> Every account requires a verified
                email address, two-factor authentication, and agreement to our Terms of
                Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              4. In-App Reporting Tools
            </h2>
            <p>
              Every user can report child safety concerns directly from inside the
              Familial app. Reporting is available on:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Posts, photos, and videos in the feed</li>
              <li>Comments and replies</li>
              <li>Direct and group messages</li>
              <li>Photo albums and shared media</li>
              <li>User profiles</li>
            </ul>
            <p className="mt-2">
              Users may also <strong>Block</strong> any other user to immediately remove
              all contact and shared content visibility between the two accounts. Reports
              are delivered to our trust and safety team and triaged within 24 hours.
              Reports involving suspected CSAM are escalated immediately and reported to
              NCMEC.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              5. Reporting to Authorities
            </h2>
            <p>
              In compliance with 18 U.S.C. § 2258A, Familial reports apparent child
              sexual abuse material to the National Center for Missing & Exploited
              Children (NCMEC) CyberTipline. We preserve relevant content and account
              metadata as required by law and cooperate with valid legal process from
              law enforcement agencies investigating child exploitation, both in the
              United States and in other jurisdictions where applicable.
            </p>
            <p className="mt-2">
              To report suspected child exploitation directly to authorities:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>United States:</strong>{" "}
                <a
                  href="https://report.cybertip.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  NCMEC CyberTipline
                </a>{" "}
                or call 1-800-843-5678
              </li>
              <li>
                <strong>International:</strong>{" "}
                <a
                  href="https://www.inhope.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  INHOPE network of hotlines
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              6. Designated Point of Contact
            </h2>
            <p>
              Our designated point of contact for child safety, CSAE prevention, and
              CSAM compliance matters is:
            </p>
            <div className="mt-3 space-y-1">
              <p><strong>Familial, LLC — Trust & Safety</strong></p>
              <p>
                Email:{" "}
                <a
                  href="mailto:support@familialmedia.com"
                  className="text-primary hover:underline"
                >
                  support@familialmedia.com
                </a>
              </p>
              <p>
                Phone:{" "}
                <a href="tel:480-648-9596" className="text-primary hover:underline">
                  (480) 648-9596
                </a>
              </p>
            </div>
            <p className="mt-3">
              This contact is monitored and able to respond to questions from Google,
              Apple, NCMEC, law enforcement, and the general public about our child
              safety practices and compliance.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              7. Changes to These Standards
            </h2>
            <p>
              We may update these Child Safety Standards from time to time as our
              practices evolve. Material changes will be reflected by updating the
              "Effective Date" above.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChildSafety;
