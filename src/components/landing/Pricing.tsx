import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Phone, ArrowRight, Loader2, Camera, Calendar, MessageCircle, Smartphone, Users, Bell, Shield, Image, Video, Settings, Globe, StickyNote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRICES = {
  family: "price_1T3N5bCiWDzualH5Cf7G7VsM",
  extended: "price_1T3N5nCiWDzualH5SBHxbHqo",
};

const PLAN_RANK: Record<string, number> = { free: 0, family: 1, extended: 2 };

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/forever",
    description: "For small families getting started",
    features: ["1 circle", "Up to 8 members per circle"],
    cta: "Get Started Free",
    popular: false,
    plan: "free",
  },
  {
    name: "Family",
    price: "$7",
    period: "/month",
    description: "For growing families who need more space",
    features: ["Up to 2 circles", "Up to 20 members per circle"],
    cta: "Buy Now",
    popular: true,
    plan: "family",
  },
  {
    name: "Extended",
    price: "$15",
    period: "/month",
    description: "For large families and reunions",
    features: ["Up to 3 circles", "Up to 35 members per circle"],
    cta: "Buy Now",
    popular: false,
    plan: "extended",
  },
];

const sharedFeatures = [
  { icon: Camera, title: "Unlimited Posts & Photos", description: "Share as many moments as you want with no storage limits." },
  { icon: Video, title: "Video Sharing", description: "Upload and share family videos directly in your circle." },
  { icon: Calendar, title: "Event Planning & Calendars", description: "Organize gatherings, birthdays, and reunions with shared calendars." },
  { icon: Image, title: "Photo Albums", description: "Create and collaborate on beautiful photo albums together." },
  { icon: MessageCircle, title: "Private Messaging", description: "Chat one-on-one or in groups within your family circle." },
  { icon: StickyNote, title: "Family Fridge", description: "Pin save the dates or leave a note for your family." },
  { icon: Smartphone, title: "Mobile & Web Access", description: "Stay connected from any device, anywhere." },
  { icon: Users, title: "Circle Management", description: "Invite members, assign roles, and manage your circles with ease." },
  { icon: Bell, title: "Notifications", description: "Stay up to date with activity in your circles." },
  { icon: Shield, title: "No Sale of Data", description: "Your family's data is never sold or shared with third parties." },
  { icon: Globe, title: "Shareable Invite Links", description: "Easily invite family members with a simple link." },
  { icon: Settings, title: "Profile Customization", description: "Personalize your profile with photos, bios, and more." },
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [cancelingPlan, setCancelingPlan] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; targetPlan: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setCurrentPlan(null);
      setCancelAtPeriodEnd(false);
      setCurrentPeriodEnd(null);
      return;
    }
    supabase
      .from("user_plans")
      .select("plan, cancel_at_period_end, current_period_end")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setCurrentPlan(data?.plan ?? "free");
        setCancelAtPeriodEnd(data?.cancel_at_period_end ?? false);
        setCurrentPeriodEnd(data?.current_period_end ?? null);
      });
  }, [user]);

  const handleBuyNow = async (plan: string) => {
    if (plan === "free") {
      if (!user) {
        navigate("/auth");
        return;
      }
      // User wants to cancel to free — show confirmation
      setConfirmDialog({ open: true, targetPlan: "free" });
      return;
    }

    if (!user) {
      navigate(`/auth?plan=${plan}`);
      return;
    }

    const priceId = PRICES[plan as keyof typeof PRICES];
    if (!priceId) return;

    setLoadingPlan(plan);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, mode: "subscription" },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCancelConfirm = async () => {
    setCancelingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      if (data?.success) {
        setCancelAtPeriodEnd(true);
        setCurrentPeriodEnd(data.current_period_end);
        toast({
          title: "Subscription canceled",
          description: `You'll keep access until ${formatPeriodEnd(data.current_period_end)}.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to cancel subscription.", variant: "destructive" });
    } finally {
      setCancelingPlan(false);
      setConfirmDialog(null);
    }
  };

  const formatPeriodEnd = (dateStr: string | null) => {
    if (!dateStr) return "the end of your billing period";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const getButtonForTier = (tierPlan: string, tierPopular: boolean, tierCta: string) => {
    if (!user || !currentPlan) {
      // Not logged in
      return (
        <Button
          variant={tierPopular ? "default" : "outline"}
          className="w-full"
          size="lg"
          onClick={() => handleBuyNow(tierPlan)}
          disabled={loadingPlan !== null}
        >
          {loadingPlan === tierPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {tierCta}
          {loadingPlan !== tierPlan && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      );
    }

    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    const tierRank = PLAN_RANK[tierPlan] ?? 0;

    // Current plan
    if (tierPlan === currentPlan) {
      if (cancelAtPeriodEnd) {
        return (
          <Button variant="secondary" className="w-full" size="lg" disabled>
            Canceling {formatPeriodEnd(currentPeriodEnd)}
          </Button>
        );
      }
      return (
        <Button variant="secondary" className="w-full" size="lg" disabled>
          Current Tier
        </Button>
      );
    }

    // Higher tier — upgrade
    if (tierRank > currentRank) {
      return (
        <Button
          variant={tierPopular ? "default" : "outline"}
          className="w-full"
          size="lg"
          onClick={() => handleBuyNow(tierPlan)}
          disabled={loadingPlan !== null || cancelingPlan}
        >
          {loadingPlan === tierPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Upgrade
          {loadingPlan !== tierPlan && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      );
    }

    // Lower tier — downgrade / cancel
    if (cancelAtPeriodEnd) {
      // Already canceling, lower tiers should just show disabled
      return (
        <Button variant="outline" className="w-full" size="lg" disabled>
          {tierPlan === "free" ? "Cancel Pending" : "Downgrade Pending"}
        </Button>
      );
    }

    const label = tierPlan === "free" ? "Cancel Membership" : "Downgrade";
    return (
      <Button
        variant="outline"
        className="w-full"
        size="lg"
        onClick={() => setConfirmDialog({ open: true, targetPlan: tierPlan })}
        disabled={cancelingPlan}
      >
        {label}
      </Button>
    );
  };

  const dialogTargetName = confirmDialog
    ? tiers.find((t) => t.plan === confirmDialog.targetPlan)?.name ?? "Free"
    : "";

  return (
    <section id="pricing" className="pt-20 md:pt-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No hidden fees. No data harvesting. Just a fair price for keeping your family connected.
          </p>
        </div>

        <p className="text-center text-muted-foreground mb-8 text-sm font-medium uppercase tracking-wider">
          Choose your plan
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative ${tier.popular ? "border-2 border-foreground shadow-xl" : "border border-border"}`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}
              <CardHeader className="pb-8 pt-6">
                <CardTitle className="font-serif text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-muted-foreground">{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-serif font-bold text-foreground">{tier.price}</span>
                  <span className="text-muted-foreground">{tier.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-foreground" />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-3 border-t border-border pt-3 mt-1">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <a href="#all-features" className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors">
                      All features included
                    </a>
                  </li>
                </ul>
                <div className="pt-4">
                  {getButtonForTier(tier.plan, tier.popular, tier.cta)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Plans */}
        <div className="max-w-xl mx-auto mb-8">
          <Card className="bg-secondary/50 border-border">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Need a Custom Plan?
              </h3>
              <p className="text-muted-foreground text-center">
                For organizations, communities, or larger groups — we've got you covered.
              </p>
              <a href="tel:520-759-5200">
                <Button variant="outline" size="lg" className="whitespace-nowrap">
                  <Phone className="w-4 h-4 mr-2" />
                  Call 520-759-5200
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* All Plans Include */}
      <div id="all-features" className="w-full bg-secondary py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 scroll-mt-8">
        <h3 className="font-serif text-2xl sm:text-3xl font-bold text-foreground text-center mb-3">
          Every plan includes
        </h3>
        <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
          No matter which plan you choose, you get the full Familial experience.
        </p>
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
          {sharedFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-1">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">{feature.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancel/Downgrade Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog?.open ?? false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.targetPlan === "free"
                ? "Cancel your subscription?"
                : `Downgrade to ${dialogTargetName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              You'll keep full access to your current plan until{" "}
              {formatPeriodEnd(currentPeriodEnd)}. After that, your plan will switch to{" "}
              {dialogTargetName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Current Plan</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} disabled={cancelingPlan}>
              {cancelingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default Pricing;
