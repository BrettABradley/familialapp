import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";

const CURRENT_TERMS_VERSION = "2026-04-13";

export const TermsAcceptanceGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || loading) return;

    const checkTerms = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("accepted_terms_at, accepted_terms_version")
        .eq("user_id", user.id)
        .single();

      if (data && (!(data as any).accepted_terms_at || (data as any).accepted_terms_version !== CURRENT_TERMS_VERSION)) {
        setNeedsAcceptance(true);
      }
      setLoaded(true);
    };

    checkTerms();
  }, [user, loading]);

  const handleAccept = async () => {
    if (!user || !checked) return;
    setSubmitting(true);

    await supabase
      .from("profiles")
      .update({
        accepted_terms_at: new Date().toISOString(),
        accepted_terms_version: CURRENT_TERMS_VERSION,
      } as any)
      .eq("user_id", user.id);

    setNeedsAcceptance(false);
    setSubmitting(false);
  };

  if (!loaded && user) return null;

  return (
    <>
      {children}
      <Dialog open={needsAcceptance} onOpenChange={() => {}}>
        <DialogContent className="max-w-md [&>button:last-child]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Welcome to Familial</DialogTitle>
            <DialogDescription>
              Please review and accept our Terms of Service to continue.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-48 rounded-md border p-4 text-sm text-muted-foreground">
            <p className="mb-3">
              By using Familial, you agree to our{" "}
              <Link to="/terms" target="_blank" className="text-primary underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" className="text-primary underline">
                Privacy Policy
              </Link>.
            </p>
            <p className="mb-3 font-medium text-foreground">
              Community Standards
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Zero tolerance for objectionable content.</strong> Content that is illegal, hateful, violent, sexually explicit, or otherwise objectionable is strictly prohibited and will be removed.
              </li>
              <li>
                <strong>No abusive behavior.</strong> Harassment, bullying, threats, or any form of abuse toward other users will not be tolerated. Accounts engaging in abusive behavior will be suspended or terminated.
              </li>
              <li>
                <strong>Content moderation.</strong> We use automated systems and manual review to detect and remove objectionable content. Reported content is reviewed within 24 hours.
              </li>
              <li>
                <strong>Report and block.</strong> You can report objectionable content and block abusive users at any time. Blocking immediately removes that user's content from your view and notifies our team.
              </li>
            </ul>
          </ScrollArea>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="accept-terms"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <label htmlFor="accept-terms" className="text-sm leading-snug cursor-pointer">
              I have read and agree to the Terms of Service, Privacy Policy, and Community Standards.
            </label>
          </div>

          <DialogFooter>
            <Button onClick={handleAccept} disabled={!checked || submitting} className="w-full">
              {submitting ? "Accepting..." : "Accept & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
