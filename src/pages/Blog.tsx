import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">Blog</h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <p className="text-lg text-muted-foreground">
            Coming soon — stories, updates, and tips for staying connected as a family.
          </p>
          <p>
            We're working on sharing helpful content about family connection, privacy, and making the most of Familial. Stay tuned!
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
