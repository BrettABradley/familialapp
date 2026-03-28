import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SEO from "@/components/shared/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Newspaper, Calendar, Image, MessageSquare, Pin, Mail, Phone } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Circles",
    description: "Private groups for your family or close friends. Each circle has its own feed, events, albums, and more.",
    howTo: [
      "Tap Circles in the navigation bar.",
      "Tap \"Create a Circle\" and give it a name.",
      "Invite members by email — they'll get a notification to join.",
      "Switch between circles using the dropdown in the header.",
    ],
  },
  {
    icon: Newspaper,
    title: "Feed",
    description: "Share updates, photos, videos, and voice notes with your circle. Tag members with @mentions.",
    howTo: [
      "Open the Feed tab and type your message.",
      "Add up to 4 photos or videos per post.",
      "Use @name to tag circle members.",
      "React to posts and leave comments.",
    ],
  },
  {
    icon: Calendar,
    title: "Events",
    description: "Plan family gatherings, birthdays, and reunions. RSVP tracking keeps everyone in the loop.",
    howTo: [
      "Go to Events and tap the + button.",
      "Set a title, date, time, and location.",
      "Circle members receive a notification and can RSVP.",
      "Optionally link a photo album to the event.",
    ],
  },
  {
    icon: Image,
    title: "Albums",
    description: "Collaborative photo albums where every member can contribute. Perfect for trips, holidays, and milestones.",
    howTo: [
      "Navigate to Albums and create a new album.",
      "Upload photos — any circle member can add to the album.",
      "Set a cover photo to make the album stand out.",
    ],
  },
  {
    icon: MessageSquare,
    title: "Messages",
    description: "Private 1-on-1 messaging and group chats within your circles.",
    howTo: [
      "Open Messages and start a new conversation.",
      "Send text, photos, or voice messages.",
      "Create group chats with multiple circle members.",
    ],
  },
  {
    icon: Pin,
    title: "Family Fridge",
    description: "Pin important notes, reminders, lists, or photos to your circle's shared fridge board.",
    howTo: [
      "Tap Fridge in the navigation.",
      "Create a new pin with a title and optional content or image.",
      "All circle members can see and interact with pins.",
    ],
  },
];

const Support = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Support & How-To Guide - Familial" description="Everything you need to get the most out of Familial — guides for Circles, Feed, Events, Albums, Messages, and more." path="/support" />
      <Header />
      <main className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 text-center">
          Support & How-To Guide
        </h1>
        <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Everything you need to get the most out of Familial — your family's private space.
        </p>

        <div className="space-y-8">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-serif text-xl">
                  <feature.icon className="w-6 h-6 text-primary" />
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{feature.description}</p>
                <div>
                  <h3 className="font-semibold text-sm text-foreground mb-2">How to get started:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    {feature.howTo.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="font-serif text-xl text-center">Need More Help?</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Our support team is here for you. Reach out anytime and we'll get back to you as soon as possible.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <a href="mailto:support@familialmedia.com" className="flex items-center gap-2 text-primary hover:underline">
                <Mail className="w-4 h-4" />
                support@familialmedia.com
              </a>
              <a href="tel:+14806489596" className="flex items-center gap-2 text-primary hover:underline">
                <Phone className="w-4 h-4" />
                (480) 648-9596
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Support;
