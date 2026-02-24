import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Crown, Users } from "lucide-react";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import UpgradePlanDialog from "@/components/circles/UpgradePlanDialog";

const TransferBlockBanner = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, refetchCircles, profile, userPlan } = useCircleContext();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const circle = circles.find(c => c.id === selectedCircle);
  if (!circle || !(circle as any).transfer_block) return null;

  const isOwner = circle.owner_id === user?.id;

  const handleClaim = async () => {
    if (!user || !circle) return;
    setIsClaiming(true);

    const oldOwnerId = circle.owner_id;

    const { error } = await supabase.rpc("claim_circle_ownership" as any, {
      _circle_id: circle.id,
    });

    if (error) {
      if (error.message?.includes("CIRCLE_LIMIT_REACHED")) {
        setShowUpgrade(true);
      } else {
        toast({ title: "Error", description: error.message || "Failed to claim ownership.", variant: "destructive" });
      }
      setIsClaiming(false);
      return;
    }

    // Notify old owner
    await supabase.from("notifications").insert({
      user_id: oldOwnerId,
      type: "transfer_block",
      title: "Ownership Claimed",
      message: `${profile?.display_name || "A member"} has claimed ownership of "${circle.name}".`,
      related_circle_id: circle.id,
      related_user_id: user.id,
    });

    toast({ title: "Ownership claimed!", description: `You are now the owner of "${circle.name}".` });
    await refetchCircles();
    setIsClaiming(false);
  };

  const ownedCount = circles.filter(c => c.owner_id === user?.id).length;

  return (
    <>
      <Alert className="mb-6 border-destructive/50 bg-destructive/10">
        <Users className="h-4 w-4 text-destructive" />
        <AlertDescription className="flex items-center justify-between gap-4">
          <span className="text-sm">
            {isOwner
              ? "This circle is on transfer block. Waiting for someone to claim ownership."
              : `"${circle.name}" needs a new owner. Claim ownership to keep it going.`}
          </span>
          {!isOwner && (
            <Button size="sm" onClick={handleClaim} disabled={isClaiming}>
              <Crown className="w-4 h-4 mr-1" />
              {isClaiming ? "Claiming..." : "Claim Ownership"}
            </Button>
          )}
        </AlertDescription>
      </Alert>

      <UpgradePlanDialog
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        currentPlan={userPlan?.plan || "free"}
        currentCount={ownedCount}
        limit={userPlan?.max_circles || 1}
        circleId={circle.id}
      />
    </>
  );
};

export default TransferBlockBanner;
