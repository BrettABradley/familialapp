import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Heart, Users } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 hero-gradient">
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo Icon */}
          <div className="flex justify-center mb-8 animate-fade-up">
            <img src={logo} alt="Familial" className="h-24 md:h-32 w-auto" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary backdrop-blur-sm mb-8 animate-fade-up border border-border">
            <Shield className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Private by Design • No Ads • No Algorithms
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Where Family
            <br />
            <span className="text-foreground">Actually Connects</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            A private social space for the people who matter most. Share moments, plan events, and stay close — without the noise of public social media.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Link to="/auth">
              <Button variant="hero" size="xl">
                Start Your Family Circle
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="hero-outline" size="xl">
                See How It Works
              </Button>
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 text-muted-foreground animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-foreground" />
              <span className="text-sm font-medium">100% Ad-Free</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-foreground" />
              <span className="text-sm font-medium">End-to-End Privacy</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-foreground" />
              <span className="text-sm font-medium">Family-First Design</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
