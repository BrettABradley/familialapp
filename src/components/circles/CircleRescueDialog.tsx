import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRICES: Record<string, { priceId: string; name: string; price: string }> = {
  family: { priceId: "price_1T3N5bCiWDzualH5Cf7G7VsM", name: "Family", price: "$7/mo" },
  extended: { priceId: "price_1T3N5nCiWDzualH5SBHxbHqo", name: "Extended", price: "$15/mo" },
};

interface CircleRescueDialogProps {
  circleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RescueOffer {
  id: string;
  circle_id: string;
  current_owner: string;
  deadline: string;
  status: string;
}

const CircleRescueDialog = ({ circleId, open, onOpenChange }: CircleRescueDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offer, setOffer] = useState<RescueOffer | null>(null);
  const [circleName, setCircleName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (!circleId || !open) return;
    setLoading(true);

    const fetchData = async () => {
      // Fetch rescue offer
      const { data: offers } = await supabase
        .from("circle_rescue_offers")
        .select("*")
        .eq("circle_id", circleId)
        .eq("status", "open")
        .limit(1);

      const rescueOffer = (offers as any)?.[0] ?? null;
      setOffer(rescueOffer);

      // Fetch circle name
      const { data: circle } = await supabase
        .from("circles")
        .select("name, owner_id")
        .eq("id", circleId)
        .single();

      setCircleName(circle?.name ?? "this circle");

      if (circle?.owner_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", circle.owner_id)
          .single();
        setOwnerName(profile?.display_name ?? "The owner");
      }

      setLoading(false);
    };

    fetchData();
  }, [circleId, open]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const handleTakeOver = async () => {
    if (!offer || !user) return;
    setCheckoutLoading(true);

    try {
      // Determine which plan is needed — at minimum Family
      const plan = PRICES.family;

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: plan.priceId,
          mode: "subscription",
          circleId: offer.circle_id,
        },
      });

      if (error) throw error;
      if (data?.url) {
        // Mark the offer as claimed before redirecting
        await supabase
          .from("circle_rescue_offers")
          .update({ claimed_by: user.id, status: "claimed" } as any)
          .eq("id", offer.id);

        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout.", variant: "destructive" });
      setCheckoutLoading(false);
    }
  };

  const isExpired = offer ? new Date(offer.deadline) < new Date() : false;
  const isOwner = user?.id === offer?.current_owner;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Circle Needs a New Owner
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              {loading ? (
                <p>Loading...</p>
              ) : !offer ? (
                <p>No active rescue offer found for this circle.</p>
              ) : isExpired ? (
                <p>The rescue window for "{circleName}" has expired. This circle is now read-only.</p>
              ) : isOwner ? (
                <p>You created this rescue offer. Members have been notified and can take over until {formatDate(offer.deadline)}.</p>
              ) : (
                <>
                  <p>
                    <strong>{ownerName}</strong> is downgrading their plan. <strong>"{circleName}"</strong> will become read-only on{" "}
                    <strong>{formatDate(offer.deadline)}</strong> unless someone takes over.
                  </p>
                  <p className="text-sm">
                    By taking over, you'll become the circle owner and start a Family plan subscription ({PRICES.family.price}).
                    All existing content and members will be preserved.
                  </p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        {offer && !isExpired && !isOwner && !loading && (
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Not Now
            </Button>
            <Button onClick={handleTakeOver} disabled={checkoutLoading}>
              {checkoutLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Take Over — {PRICES.family.price}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CircleRescueDialog;
