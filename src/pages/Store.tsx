import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Target, DollarSign, Phone, ArrowLeft, Send, Users, MapPin, BarChart, LogIn } from "lucide-react";
import logo from "@/assets/logo.png";
import { z } from "zod";

// Validation schema for store offer form
const storeOfferSchema = z.object({
  companyName: z.string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name must be 200 characters or less"),
  companyEmail: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be 255 characters or less"),
  companyPhone: z.string()
    .trim()
    .max(50, "Phone number must be 50 characters or less")
    .optional()
    .or(z.literal("")),
  offerTitle: z.string()
    .trim()
    .min(1, "Offer title is required")
    .max(200, "Offer title must be 200 characters or less"),
  offerDescription: z.string()
    .trim()
    .max(2000, "Description must be 2000 characters or less")
    .optional()
    .or(z.literal("")),
  targetLocations: z.string()
    .trim()
    .max(500, "Target locations must be 500 characters or less")
    .optional()
    .or(z.literal("")),
});

type FormData = z.infer<typeof storeOfferSchema>;

interface FormErrors {
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  offerTitle?: string;
  offerDescription?: string;
  targetLocations?: string;
}

const Store = () => {
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    offerTitle: "",
    offerDescription: "",
    targetLocations: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    // Clear errors when form data changes
    setErrors({});
  }, [formData]);

  const validateForm = (): boolean => {
    const result = storeOfferSchema.safeParse(formData);
    
    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormErrors;
        if (field) {
          newErrors[field] = err.message;
        }
      });
      setErrors(newErrors);
      return false;
    }
    
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to submit an offer.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("store_offers").insert({
      company_name: formData.companyName.trim(),
      company_email: formData.companyEmail.trim(),
      company_phone: formData.companyPhone?.trim() || null,
      offer_title: formData.offerTitle.trim(),
      offer_description: formData.offerDescription?.trim() || null,
      target_locations: formData.targetLocations
        ? formData.targetLocations.split(",").map((l) => l.trim()).filter(Boolean)
        : [],
      is_active: false, // Requires approval
      submitted_by: user.id, // Track who submitted the offer for rate limiting and ownership
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit your offer. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Offer Submitted!",
        description: "We'll review your offer and get back to you within 24-48 hours.",
      });
      setFormData({
        companyName: "",
        companyEmail: "",
        companyPhone: "",
        offerTitle: "",
        offerDescription: "",
        targetLocations: "",
      });
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Familial" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            {!user && (
              <Link to="/auth">
                <Button variant="outline" size="sm">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </Link>
            )}
            <a href="tel:520-759-5200">
              <Button variant="outline" size="sm">
                <Phone className="w-4 h-4 mr-2" />
                520-759-5200
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 hero-gradient border-b border-border">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6">
            Familial Store
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Connect your business with local families through targeted, respectful advertising that adds value to their lives.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
              <Target className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium">Location-Based Targeting</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
              <Users className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium">Family-Focused Audience</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
              <DollarSign className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium">Fair Pricing</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
            How Familial Store Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-foreground" />
                </div>
                <CardTitle className="font-serif text-xl">1. Submit Your Offer</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Tell us about your business and create a special offer for local families on Familial.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-foreground" />
                </div>
                <CardTitle className="font-serif text-xl">2. Target by Location</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Your offers are shown to families in your target areas based on user locations.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                  <BarChart className="w-8 h-8 text-foreground" />
                </div>
                <CardTitle className="font-serif text-xl">3. Track Results</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Monitor impressions and engagement. Pay only for verified family views.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Pricing Info */}
          <Card className="max-w-3xl mx-auto mb-16 border-2 border-foreground">
            <CardContent className="py-8 text-center">
              <h3 className="font-serif text-2xl font-bold text-foreground mb-4">
                Transparent Pricing
              </h3>
              <p className="text-muted-foreground mb-6">
                Starting at <span className="text-foreground font-semibold">$0.01 per impression</span>. 
                Custom packages available for larger campaigns.
              </p>
              <a href="tel:520-759-5200">
                <Button size="lg">
                  <Phone className="w-4 h-4 mr-2" />
                  Call to Discuss: 520-759-5200
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Submit Form */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Submit Your Offer</CardTitle>
              <CardDescription>
                {user 
                  ? "Fill out the form below and we'll review your offer within 24-48 hours."
                  : "Please sign in to submit an offer. We require authentication to prevent spam and ensure quality submissions."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <div className="text-center py-8">
                  <LogIn className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-6">
                    Sign in to submit your business offer to Familial.
                  </p>
                  <Link to="/auth">
                    <Button size="lg">
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In to Continue
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        placeholder="Your Business Name"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        maxLength={200}
                        required
                        aria-invalid={!!errors.companyName}
                      />
                      {errors.companyName && (
                        <p className="text-sm text-destructive">{errors.companyName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Business Email *</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        placeholder="contact@yourbusiness.com"
                        value={formData.companyEmail}
                        onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                        maxLength={255}
                        required
                        aria-invalid={!!errors.companyEmail}
                      />
                      {errors.companyEmail && (
                        <p className="text-sm text-destructive">{errors.companyEmail}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Phone Number</Label>
                    <Input
                      id="companyPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.companyPhone}
                      onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                      maxLength={50}
                      aria-invalid={!!errors.companyPhone}
                    />
                    {errors.companyPhone && (
                      <p className="text-sm text-destructive">{errors.companyPhone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offerTitle">Offer Title *</Label>
                    <Input
                      id="offerTitle"
                      placeholder="e.g., 20% Off Family Pizza Night"
                      value={formData.offerTitle}
                      onChange={(e) => setFormData({ ...formData, offerTitle: e.target.value })}
                      maxLength={200}
                      required
                      aria-invalid={!!errors.offerTitle}
                    />
                    {errors.offerTitle && (
                      <p className="text-sm text-destructive">{errors.offerTitle}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offerDescription">Offer Description</Label>
                    <Textarea
                      id="offerDescription"
                      placeholder="Describe your offer and what makes it great for families..."
                      value={formData.offerDescription}
                      onChange={(e) => setFormData({ ...formData, offerDescription: e.target.value })}
                      maxLength={2000}
                      rows={4}
                      aria-invalid={!!errors.offerDescription}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{errors.offerDescription && <span className="text-destructive">{errors.offerDescription}</span>}</span>
                      <span>{formData.offerDescription?.length || 0}/2000</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetLocations">Target Locations</Label>
                    <Input
                      id="targetLocations"
                      placeholder="e.g., Tucson, Phoenix, Scottsdale (comma-separated)"
                      value={formData.targetLocations}
                      onChange={(e) => setFormData({ ...formData, targetLocations: e.target.value })}
                      maxLength={500}
                      aria-invalid={!!errors.targetLocations}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter city names separated by commas. Leave blank for nationwide.
                    </p>
                    {errors.targetLocations && (
                      <p className="text-sm text-destructive">{errors.targetLocations}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={isSubmitting}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Submitting..." : "Submit Offer for Review"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-12 bg-secondary border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground mb-4">
            Questions about advertising on Familial?
          </p>
          <a href="tel:520-759-5200">
            <Button variant="outline" size="lg">
              <Phone className="w-4 h-4 mr-2" />
              Call Support: 520-759-5200
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default Store;