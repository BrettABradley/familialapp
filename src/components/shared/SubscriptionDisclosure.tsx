import { Link } from "react-router-dom";

interface SubscriptionDisclosureProps {
  variant?: "full" | "compact";
  className?: string;
}

/**
 * Apple App Store guideline 3.1.2(c) compliance block.
 * Must be visible at every IAP point of purchase. Includes:
 *  - Subscription title, length, and price
 *  - Auto-renewal terms
 *  - Functional EULA (Terms of Use) + Privacy Policy links
 */
const SubscriptionDisclosure = ({ variant = "full", className = "" }: SubscriptionDisclosureProps) => {
  if (variant === "compact") {
    return (
      <p className={`text-xs text-muted-foreground leading-relaxed ${className}`}>
        Auto-renews monthly until canceled. Manage in Apple ID Settings.{" "}
        <Link to="/terms-of-service" className="underline hover:text-foreground">
          Terms of Use (EULA)
        </Link>
        {" · "}
        <Link to="/privacy-policy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
      </p>
    );
  }

  return (
    <div className={`rounded-md border border-border bg-secondary/30 p-4 text-xs text-muted-foreground leading-relaxed space-y-2 ${className}`}>
      <p className="font-semibold text-foreground text-sm">Auto-renewable subscriptions</p>
      <ul className="space-y-1 list-disc list-inside">
        <li>
          <span className="text-foreground font-medium">Family</span> — $7.00 USD per month, length 1 month, renews monthly until canceled.
        </li>
        <li>
          <span className="text-foreground font-medium">Extended</span> — $15.00 USD per month, length 1 month, renews monthly until canceled.
        </li>
      </ul>
      <p>
        Payment is charged to your Apple ID at confirmation of purchase. Subscriptions automatically renew
        unless auto-renew is turned off at least 24 hours before the end of the current period. Your account
        will be charged for renewal within 24 hours prior to the end of the current period. You can manage
        or cancel your subscriptions in your Apple ID Settings → Subscriptions after purchase.
      </p>
      <p>
        <Link to="/terms-of-service" className="underline hover:text-foreground">
          Terms of Use (EULA)
        </Link>
        {" · "}
        <Link to="/privacy-policy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
};

export default SubscriptionDisclosure;
