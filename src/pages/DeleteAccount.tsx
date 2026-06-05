import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SEO from "@/components/shared/SEO";

export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Delete Your Familial Account"
        description="How to request deletion of your Familial account and associated data."
        canonicalUrl="https://familialmedia.com/delete-account"
      />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-serif text-4xl mb-2">Delete Your Familial Account</h1>
        <p className="text-muted-foreground mb-8">
          Familial Media — Account &amp; Data Deletion Request
        </p>

        <section className="space-y-4 mb-10">
          <h2 className="font-serif text-2xl">How to delete your account from inside the app</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Open the <strong>Familial</strong> app (iOS or Android) and sign in.</li>
            <li>Tap your profile picture, then go to <strong>Settings</strong>.</li>
            <li>Open the <strong>Your Account</strong> section.</li>
            <li>Scroll to the bottom and tap <strong>Delete Account</strong>.</li>
            <li>Confirm the 3-step deletion prompt. Your account is removed immediately.</li>
          </ol>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="font-serif text-2xl">Request deletion by email</h2>
          <p>
            If you can't access the app, email{" "}
            <a className="underline" href="mailto:support@familialmedia.com?subject=Delete%20My%20Account">
              support@familialmedia.com
            </a>{" "}
            from the email address on your account with the subject{" "}
            <em>"Delete My Account"</em>. We will verify your identity and delete your account within 7 days.
          </p>
          <Button asChild>
            <a href="mailto:support@familialmedia.com?subject=Delete%20My%20Account">
              Email a deletion request
            </a>
          </Button>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="font-serif text-2xl">What gets deleted</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your profile (name, username, avatar, bio)</li>
            <li>Your posts, photos, videos, audio, comments, and reactions</li>
            <li>Your circles you own (members are notified), and your membership in other circles</li>
            <li>Your messages, group chats, events, fridge pins, and album uploads</li>
            <li>Your notification settings, push tokens, and 2FA records</li>
            <li>Your email, password hash, and authentication identities</li>
          </ul>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="font-serif text-2xl">What may be kept, and for how long</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Billing &amp; tax records</strong> (Stripe / Google Play / Apple receipts): retained up to{" "}
              <strong>7 years</strong> as required by law.
            </li>
            <li>
              <strong>Safety &amp; abuse records</strong> (banned emails, moderation actions): retained
              indefinitely to prevent re-registration of banned accounts.
            </li>
            <li>
              <strong>Anonymized, non-identifying backups</strong>: purged from rolling backups within{" "}
              <strong>30 days</strong>.
            </li>
            <li>
              Content you shared in circles owned by other users is removed from your account, but
              copies kept by other members for their own records may persist until they delete them.
            </li>
          </ul>
        </section>

        <section className="space-y-2 mb-10">
          <h2 className="font-serif text-2xl">Questions?</h2>
          <p>
            Contact{" "}
            <a className="underline" href="mailto:support@familialmedia.com">
              support@familialmedia.com
            </a>{" "}
            or visit our <Link className="underline" to="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
