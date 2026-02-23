import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Phone, ArrowRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PRICES = {
  family: "price_1T3N5bCiWDzualH5Cf7G7VsM",
  extended: "price_1T3N5nCiWDzualH5SBHxbHqo",
  
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/forever",
    description: "For small families getting started",
    features: [
      "1 circle",
      "Up to 8 members per circle",
    ],
    cta: "Get Started Free",
    popular: false,
    plan: "free",
  },
  {
    name: "Family",
    price: "$7",
    period: "/month",
    description: "For growing families who need more space",
    features: [
      "Up to 2 circles",
      "Up to 20 members per circle",
    ],
    cta: "Buy Now",
    popular: true,
    plan: "family",
  },
  {
    name: "Extended",
    price: "$15",
    period: "/month",
    description: "For large families and reunions",
    features: [
      "Up to 3 circles",
      "Up to 35 members per circle",
    ],
    cta: "Buy Now",
    popular: false,
    plan: "extended",
  },
];

const sharedFeatures = [
  "Unlimited posts & photos",
  "Event planning & calendars",
  "Photo albums",
  "Family tree features",
  "Private messaging",
  "Video sharing",
  "Mobile & web access",
  "Circle management tools",
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setCurrentPlan(null); return; }
    supabase.from("user_plans").select("plan").eq("user_id", user.id).single()
      .then(({ data }) => setCurrentPlan(data?.plan ?? "free"));
  }, [user]);

  const handleBuyNow = async (plan: string) => {
    if (plan === "free") {
      navigate("/auth");
      return;
    }


    if (!user) {
      // Not logged in — redirect to auth with plan param
      navigate(`/auth?plan=${plan}`);
      return;
    }

    // Logged in — directly trigger checkout
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

  return (
    <section id="pricing" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No hidden fees. No data harvesting. Just a fair price for keeping your family connected.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {tiers.map((tier) => (
            <Card 
              key={tier.name} 
              className={`relative ${tier.popular ? 'border-2 border-foreground shadow-xl' : 'border border-border'}`}
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
                </ul>
                <div className="pt-4">
                  {currentPlan === tier.plan ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      size="lg"
                      disabled
                    >
                      Current Tier
                    </Button>
                  ) : (
                    <Button
                      variant={tier.popular ? "default" : "outline"}
                      className="w-full"
                      size="lg"
                      onClick={() => handleBuyNow(tier.plan)}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === tier.plan ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {tier.cta}
                      {loadingPlan !== tier.plan && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* All Plans Include */}
        <div className="max-w-4xl mx-auto mb-16">
          <h3 className="font-serif text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            All plans include
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
            {sharedFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Plans */}
        <div className="max-w-xl mx-auto">
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
    </section>
  );
};

export default Pricing;
