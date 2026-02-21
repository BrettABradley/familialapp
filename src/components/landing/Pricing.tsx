import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Phone, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/forever",
    description: "Perfect for small families getting started",
    features: [
      "Creation of up to 1 circle",
      "Up to 8 members per circle",
      "Unlimited posts & photos",
      "Basic circle management",
      "Mobile & web access",
      "No ads, ever",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Family",
    price: "$7",
    period: "/month",
    description: "For growing families who want more",
    features: [
      "Creation of up to 2 circles",
      "Up to 20 members per circle",
      "Event planning & calendars",
      "Photo albums",
      "Priority support",
      "Advanced privacy controls",
    ],
    cta: "Buy Now",
    popular: true,
  },
  {
    name: "Extended",
    price: "$15",
    period: "/month",
    description: "For large families and reunions",
    features: [
      "Creation of up to 3 circles",
      "Up to 35 members per circle",
      "Family tree features",
      "Private messaging",
      "Video sharing",
      "Admin tools & analytics",
      "Need more? Add 7 members for $5",
    ],
    cta: "Buy Now",
    popular: false,
  },
];

const Pricing = () => {
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
                <Link to="/auth" className="block pt-4">
                  <Button 
                    variant={tier.popular ? "default" : "outline"} 
                    className="w-full"
                    size="lg"
                  >
                    {tier.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Plans */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-secondary/50 border-border">
            <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
              <div className="text-center md:text-left">
                <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                  Need a Custom Plan?
                </h3>
                <p className="text-muted-foreground">
                  For organizations, communities, or larger groups — we've got you covered.
                </p>
              </div>
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
