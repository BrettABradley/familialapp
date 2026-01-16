import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, Phone } from "lucide-react";
import { Link } from "react-router-dom";

const CTA = () => {
  return (
    <section className="py-20 md:py-32 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-8">
            <Heart className="w-8 h-8 text-foreground" />
          </div>

          {/* Heading */}
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
            Your Family Deserves Better Than Algorithms
          </h2>

          {/* Description */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Join thousands of families who've found a better way to stay connected.
            Start free, upgrade when you're ready.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/auth">
              <Button variant="hero" size="xl">
                Start Your Family Circle
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="tel:520-759-5200">
              <Button variant="hero-outline" size="xl">
                <Phone className="w-5 h-5" />
                Call 520-759-5200
              </Button>
            </a>
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
