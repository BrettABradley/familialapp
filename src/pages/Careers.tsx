import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Mail } from "lucide-react";

const Careers = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Careers</h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <p className="text-lg text-muted-foreground">
            We're always open to growing our team — please reach out!
          </p>
          <p>
            Familial is a small, passionate company building the private social network families deserve. If you share our values and want to make a meaningful impact, we'd love to hear from you.
          </p>
          <div className="mt-6">
            <a
              href="mailto:support@familialmedia.com?subject=Careers"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Mail className="w-4 h-4" />
              support@familialmedia.com
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Careers;
