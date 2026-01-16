import { Button } from "@/components/ui/button";
import { ArrowRight, UserPlus, Users, Share2 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create Your Account",
    description: "Sign up in seconds with just your email. No phone number required, no invasive permissions."
  },
  {
    number: "02",
    icon: Users,
    title: "Build Your Circles",
    description: "Invite your family and friends. Create circles for different groups — grandparents, siblings, childhood friends."
  },
  {
    number: "03",
    icon: Share2,
    title: "Start Sharing",
    description: "Post photos, updates, and memories. Choose exactly which circles see each post. Watch your family story grow."
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <span className="text-primary font-medium text-sm uppercase tracking-wider">How It Works</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mt-4 mb-6">
            Getting Started Takes Minutes
          </h2>
          <p className="text-lg text-muted-foreground">
            No complicated setup, no learning curve. If you can use a group chat, you can use Familial.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector Line (desktop only) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-14 left-1/2 w-full h-0.5 bg-border" />
                )}
                
                <div className="relative bg-background rounded-2xl p-8 border border-border/50 hover:shadow-lg transition-shadow">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-8">
                    <span className="font-serif text-4xl font-bold text-primary/20">{step.number}</span>
                  </div>
                  
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-6 mt-4">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>
                  
                  <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Button variant="hero" size="lg">
            Create Your First Circle
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
