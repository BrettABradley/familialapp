import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Appeal = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!email || message.trim().length < 20) {
      toast({ title: "Please fill in both fields (20+ characters).", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-appeal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email: email.trim(), message: message.trim() }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      setSubmitted(true);
    } catch (e: any) {
      toast({ title: "Could not submit", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
            <h2 className="font-serif text-xl font-semibold">Appeal received</h2>
            <p className="text-sm text-muted-foreground">
              We'll review your appeal within 7 business days and reply to {email}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif">Appeal an account decision</CardTitle>
          <CardDescription>
            If your account was suspended or removed and you believe it was a mistake,
            tell us what happened. One appeal per email address every 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email on the account</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium">Your appeal</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Explain why you believe the decision should be reversed."
            />
            <p className="text-xs text-muted-foreground mt-1">{message.length}/2000</p>
          </div>
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Submit appeal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Appeal;
