import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Mail, Phone, Shield, Eye, Heart, Users } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">About Familial</h1>
        <p className="text-lg text-muted-foreground mb-12">
          The private social network built for families — not advertisers.
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-foreground/90">
          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Our Story</h2>
            <p>
              Familial was born from a simple belief: families deserve a private space to connect — without algorithms deciding what they see, without ads interrupting their moments, and without their data being harvested and sold.
            </p>
            <p>
              We watched as mainstream social media became louder, more intrusive, and less personal. Family photos got buried under promoted posts. Private moments were mined for ad targeting. Grandparents felt overwhelmed, and parents felt uneasy sharing pictures of their kids on platforms designed to maximize engagement at any cost.
            </p>
            <p>
              So we built something different. Familial is a place where your family's story stays yours.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Our Mission</h2>
            <p>
              To give every family a living scrapbook — a private, beautiful space to share moments, plan events, preserve memories, and stay close, no matter the distance. We believe technology should bring families closer together, not exploit their attention or their data.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">What Makes Us Different</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 not-prose mt-4">
              <div className="flex gap-3 items-start">
                <Shield className="w-5 h-5 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Private by Design</h3>
                  <p className="text-sm text-muted-foreground">Your content is only visible to the people you invite into your Circles. Period.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Eye className="w-5 h-5 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">No Tracking or Ads</h3>
                  <p className="text-sm text-muted-foreground">We don't use behavioral analytics, advertising cookies, or tracking pixels.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Heart className="w-5 h-5 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">No Algorithms</h3>
                  <p className="text-sm text-muted-foreground">Your feed is chronological. We never manipulate what you see to keep you scrolling.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Users className="w-5 h-5 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Circles for Context</h3>
                  <p className="text-sm text-muted-foreground">Share with your immediate family, extended relatives, or close friends — each in their own Circle.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Who We Are</h2>
            <p>
              Familial, LLC is based in Arizona and built by people who believe that the most important connections in life — the ones with family — deserve better than what big tech offers. We're a small, passionate team committed to creating a product that respects your privacy, earns your trust, and helps your family stay connected in a meaningful way.
            </p>
            <p>
              We don't have investors demanding growth at all costs. We have families — including our own — who depend on Familial to keep their most personal moments safe and accessible.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground">Get in Touch</h2>
            <p>We'd love to hear from you — whether you have a question, feedback, or just want to say hello.</p>
            <div className="mt-4 space-y-3 not-prose">
              <a
                href="mailto:support@familialmedia.com"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">support@familialmedia.com</span>
              </a>
              <a
                href="tel:480-648-9596"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">(480) 648-9596</span>
              </a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
