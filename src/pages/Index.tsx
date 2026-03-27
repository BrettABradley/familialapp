import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Detect recovery tokens in URL hash and redirect to reset-password page
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=signup")) {
      const targetPath = hash.includes("type=recovery") ? "/reset-password" : "/auth";
      navigate(`${targetPath}${hash}`, { replace: true });
      return;
    }

    if (Capacitor.isNativePlatform() && !loading) {
      navigate(user ? "/circles" : "/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (Capacitor.isNativePlatform()) {
    return null;
  }
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
