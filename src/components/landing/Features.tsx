import { Users, Eye, Lock, Calendar, Image, MessageCircle } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Create Your Circles",
    description: "Organize your connections into meaningful groups — Immediate Family, College Friends, Work Crew. Share exactly what you want, with exactly who you want."
  },
  {
    icon: Eye,
    title: "Algorithm-Free Feed",
    description: "See every post from your circles, in chronological order. No hidden content, no suggested posts, no viral distractions. Just the people you care about."
  },
  {
    icon: Lock,
    title: "True Privacy",
    description: "Your family photos stay with your family. No data harvesting, no AI training, no advertisers. Your memories belong to you."
  },
  {
    icon: Image,
    title: "Living Scrapbook",
    description: "Every photo, video, and milestone is archived in a beautiful timeline. Create a digital family album that grows with you."
  },
  {
    icon: Calendar,
    title: "Event Coordination",
    description: "Built-in calendar for birthdays, reunions, and gatherings. Never miss a celebration, and keep all the planning in one place."
  },
  {
    icon: MessageCircle,
    title: "Threaded Conversations",
    description: "Comments and reactions that stay organized. Unlike chaotic group chats, every conversation stays connected to its context."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <span className="text-primary font-medium text-sm uppercase tracking-wider">Features</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mt-4 mb-6">
            Social Media, Reimagined for Families
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you loved about staying connected, nothing you didn't. Designed from the ground up for privacy, simplicity, and genuine connection.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="group p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
