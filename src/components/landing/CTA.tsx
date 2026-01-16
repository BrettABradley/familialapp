import { Button } from "@/components/ui/button";
import { ArrowRight, Heart } from "lucide-react";

const CTA = () => {
  return (
    <section id="pricing" className="py-20 md:py-32 hero-gradient">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-8">
            <Heart className="w-8 h-8 text-primary" />
          </div>

          {/* Heading */}
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
            Your Family Deserves Better Than Algorithms
          </h2>

          {/* Description */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Start free with up to 5 family members. No credit card required. 
            Upgrade when you're ready to invite the whole family tree.
          </p>

          {/* Pricing Card */}
          <div className="inline-block bg-card rounded-2xl p-8 md:p-10 border border-border/50 shadow-lg mb-10">
            <div className="flex items-baseline justify-center gap-2 mb-4">
              <span className="text-5xl font-serif font-bold text-foreground">Free</span>
              <span className="text-muted-foreground">to start</span>
            </div>
            <ul className="text-left space-y-3 mb-8">
              <li className="flex items-center gap-3 text-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-xs">✓</span>
                </div>
                Up to 5 family members
              </li>
              <li className="flex items-center gap-3 text-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-xs">✓</span>
                </div>
                Unlimited photo storage
              </li>
              <li className="flex items-center gap-3 text-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-xs">✓</span>
                </div>
                All core features included
              </li>
            </ul>
            <Button variant="hero" size="xl" className="w-full">
              Create Your Family Circle
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Trust Note */}
          <p className="text-sm text-muted-foreground">
            No ads. No data selling. No algorithmic nonsense. Ever.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTA;
