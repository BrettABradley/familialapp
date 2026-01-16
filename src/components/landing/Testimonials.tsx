import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah M.",
    role: "Mother of 3",
    quote: "I finally have a place to share photos of my kids without worrying about who sees them. My mom loves getting daily updates, and I love that it's just family.",
    avatar: "SM"
  },
  {
    name: "James K.",
    role: "Living abroad",
    quote: "Being 6,000 miles from home, Familial makes me feel like I'm still part of the daily life. Group chats were chaos — this is organized and beautiful.",
    avatar: "JK"
  },
  {
    name: "The Chen Family",
    role: "Multi-generational",
    quote: "Grandma is 82 and she figured it out in 5 minutes. Now she comments on every photo. That's the magic — it's simple enough for everyone.",
    avatar: "CF"
  }
];

const Testimonials = () => {
  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <span className="text-foreground font-medium text-sm uppercase tracking-wider">Testimonials</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mt-4 mb-6">
            Loved by Families Everywhere
          </h2>
          <p className="text-lg text-muted-foreground">
            Real stories from real families who've found a better way to stay connected.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div 
              key={testimonial.name}
              className="bg-card rounded-2xl p-8 border border-border hover:shadow-lg transition-shadow"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-foreground text-foreground" />
                ))}
              </div>
              
              {/* Quote */}
              <blockquote className="text-foreground leading-relaxed mb-8">
                "{testimonial.quote}"
              </blockquote>
              
              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <span className="font-serif font-semibold text-foreground">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-foreground">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
