import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is my family's data sold or shared?",
    answer:
      "Never. Your family's data belongs to you. We do not sell, share, or monetize your personal information or content in any way.",
  },
  {
    question: "Who can see my posts?",
    answer:
      "Only members of the circle you post in can see your content. Familial is a private space — nothing is public or searchable by outsiders.",
  },
  {
    question: "What's the difference between the plans?",
    answer:
      "All plans include the same features. The only difference is the number of circles you can create and how many members each circle can have. Free supports 1 circle with up to 8 members, Family supports 2 circles with up to 20 members, and Extended supports 3 circles with up to 35 members.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer:
      "Yes! You can upgrade or downgrade at any time. Changes take effect immediately, and billing is prorated so you only pay for what you use.",
  },
  {
    question: "What happens when I hit my member limit?",
    answer:
      "You'll be notified when your circle is full. To add more members, you can upgrade to a higher plan or contact us for a custom solution.",
  },
  {
    question: "Can I create multiple circles?",
    answer:
      "Yes — depending on your plan. The Free plan includes 1 circle, Family includes up to 2, and Extended includes up to 3. Each circle is completely separate with its own members, feed, and content.",
  },
  {
    question: "Is Familial available on mobile?",
    answer:
      "Familial works beautifully on any device through your web browser — no app download required. Just visit our site on your phone, tablet, or computer.",
  },
  {
    question: "How do I invite family members?",
    answer:
      "Once you create a circle, you can invite members by sharing a simple invite link or sending an email invitation directly from the app.",
  },
];

const FAQ = () => {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about Familial.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-foreground">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
