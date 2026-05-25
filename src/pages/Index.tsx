import { useEffect } from "react";
import SEO from "@/components/shared/SEO";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Is my family's data sold or shared?", acceptedAnswer: { "@type": "Answer", text: "Never. Your family's data belongs to you. We do not sell, share, or monetize your personal information or content in any way." } },
    { "@type": "Question", name: "Who can see my posts?", acceptedAnswer: { "@type": "Answer", text: "Only members of the circle you post in can see your content. Familial is a private space — nothing is public or searchable by outsiders." } },
    { "@type": "Question", name: "What's the difference between the plans?", acceptedAnswer: { "@type": "Answer", text: "All plans include the same features. The only difference is the number of circles you can create and how many members each circle can have. Free supports 1 circle with up to 8 members, Family supports 2 circles with up to 20 members, and Extended supports 3 circles with up to 35 members." } },
    { "@type": "Question", name: "Can I upgrade or downgrade my plan?", acceptedAnswer: { "@type": "Answer", text: "Yes! You can upgrade at any time and changes take effect immediately. If you downgrade or cancel, you'll keep full access to your current plan until the end of your billing period. After that, your plan will automatically adjust." } },
    { "@type": "Question", name: "What happens when I hit my member limit?", acceptedAnswer: { "@type": "Answer", text: "You'll be notified when your circle is full. To add more members, you can upgrade to a higher plan or contact us for a custom solution." } },
    { "@type": "Question", name: "Can I create multiple circles?", acceptedAnswer: { "@type": "Answer", text: "Yes — depending on your plan. The Free plan includes 1 circle, Family includes up to 2, and Extended includes up to 3. Each circle is completely separate with its own members, feed, and content." } },
    { "@type": "Question", name: "Is Familial available on mobile?", acceptedAnswer: { "@type": "Answer", text: "Familial works beautifully on any device through your web browser — no app download required. Just visit our site on your phone, tablet, or computer." } },
    { "@type": "Question", name: "How do I invite family members?", acceptedAnswer: { "@type": "Answer", text: "Once you create a circle, you can invite members by sharing a simple invite link or sending an email invitation directly from the app." } },
  ],
};

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Detect recovery tokens in URL hash and redirect to reset-password page.
    // Supabase's detectSessionInUrl may strip the hash before this effect
    // runs, so we ALSO listen for the PASSWORD_RECOVERY event as a fallback.
    const hash = window.location.hash;
    const search = window.location.search;
    if (
      hash.includes("type=recovery") ||
      hash.includes("type=signup") ||
      search.includes("type=recovery")
    ) {
      const isRecovery = hash.includes("type=recovery") || search.includes("type=recovery");
      const targetPath = isRecovery ? "/reset-password" : "/auth";
      navigate(`${targetPath}${hash || search}`, { replace: true });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
      }
    });

    if (Capacitor.isNativePlatform() && !loading) {
      navigate(user ? "/circles" : "/auth", { replace: true });
    }

    return () => subscription.unsubscribe();
  }, [user, loading, navigate]);

  if (Capacitor.isNativePlatform()) {
    return null;
  }
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Familial - Private Social Network for Families"
        description="A private social space for the people who matter most. Share moments, plan events, and stay close — without the noise of public social media."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Familial",
              url: "https://www.familialmedia.com",
              logo: "https://www.familialmedia.com/og-image.jpg",
              description: "A private social space for the people who matter most.",
            },
            faqJsonLd,
          ],
        }}
      />
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
