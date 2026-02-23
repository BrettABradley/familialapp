import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Phone, ArrowRight, Loader2, Camera, Calendar, MessageCircle, Smartphone, Users, Bell, Shield, Image, Video, Settings, Globe, StickyNote } from "lucide-react";
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
  { icon: Camera, title: "Unlimited Posts & Photos", description: "Share as many moments as you want with no storage limits." },
  { icon: Video, title: "Video Sharing", description: "Upload and share family videos directly in your circle." },
  { icon: Calendar, title: "Event Planning & Calendars", description: "Organize gatherings, birthdays, and reunions with shared calendars." },
  { icon: Image, title: "Photo Albums", description: "Create and collaborate on beautiful photo albums together." },
  { icon: MessageCircle, title: "Private Messaging", description: "Chat one-on-one or in groups within your family circle." },
  { icon: StickyNote, title: "Family Fridge", description: "Pin save the dates or leave a note for your family." },
  { icon: Smartphone, title: "Mobile & Web Access", description: "Stay connected from any device, anywhere." },
  { icon: Users, title: "Circle Management", description: "Invite members, assign roles, and manage your circles with ease." },
  { icon: Bell, title: "Notifications", description: "Stay up to date with activity in your circles." },
  { icon: Shield, title: "Content Moderation", description: "Built-in tools to keep your family space safe and positive." },
  { icon: Globe, title: "Shareable Invite Links", description: "Easily invite family members with a simple link." },
  { icon: Settings, title: "Profile Customization", description: "Personalize your profile with photos, bios, and more." },
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

        {/* Choose your circle size */}
        <p className="text-center text-muted-foreground mb-8 text-sm font-medium uppercase tracking-wider">
          Choose your plan
        </p>

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
                  {currentPlan === tier.plan ? (
                    <Button variant="secondary" className="w-full" size="lg" disabled>
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
                      {loadingPlan === tier.plan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {tier.cta}
                      {loadingPlan !== tier.plan && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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

        {/* All Plans Include */}
      </div>
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
    </section>
  );
};

export default Pricing;
