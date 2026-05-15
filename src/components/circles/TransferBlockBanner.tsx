import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Crown, Users } from "lucide-react";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import UpgradePlanDialog from "@/components/circles/UpgradePlanDialog";

const FORFEIT_AFTER_DAYS = 45;

const TransferBlockBanner = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, refetchCircles, profile, userPlan } = useCircleContext();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const circle = circles.find(c => c.id === selectedCircle);
  if (!circle || !circle.transfer_block) return null;

  const isOriginalOwner = circle.owner_id === user?.id;

  // Day counter
  const startedAt = circle.transfer_block_started_at ? new Date(circle.transfer_block_started_at) : null;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysOnBlock = startedAt
    ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / msPerDay))
    : 0;
  const daysUntilForfeit = Math.max(0, FORFEIT_AFTER_DAYS - daysOnBlock);

  const handleClaim = async () => {
    if (!user || !circle) return;
    setIsClaiming(true);

    const oldOwnerId = circle.owner_id;
    const wasReclaim = oldOwnerId === user.id;

    await supabase.auth.getSession();

    const { error } = await supabase.rpc("claim_circle_ownership", {
      _circle_id: circle.id,
    });

    if (error) {
      if (error.message?.includes("CIRCLE_LIMIT_REACHED") || error.message?.includes("PLAN_TOO_LOW")) {
        setShowUpgrade(true);
      } else {
        toast({ title: "Error", description: error.message || "Failed to claim ownership.", variant: "destructive" });
      }
      setIsClaiming(false);
      return;
    }

    // Notify the old owner only when someone else claimed it
    if (!wasReclaim) {
      await supabase.from("notifications").insert({
        user_id: oldOwnerId,
        type: "transfer_block",
        title: "Ownership Claimed",
        message: `${profile?.display_name || "A member"} has claimed ownership of "${circle.name}".`,
        related_circle_id: circle.id,
        related_user_id: user.id,
      });
    }

    toast({
      title: wasReclaim ? "Ownership reclaimed" : "Ownership claimed!",
      description: wasReclaim
        ? `Transfer block lifted on "${circle.name}".`
        : `You are now the owner of "${circle.name}".`,
    });
    await refetchCircles();
    setIsClaiming(false);
  };

  const ownedCount = circles.filter(c => c.owner_id === user?.id).length;

  return (
    <>
      <Alert className="mb-6 border-destructive/50 bg-destructive/10">
        <Users className="h-4 w-4 text-destructive" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm">
              {isOriginalOwner
                ? `"${circle.name}" is on transfer block. Until someone claims it, no one is the owner — you can reclaim it yourself any time.`
                : `"${circle.name}" needs a new owner. Claim ownership to keep it going.`}
            </p>
            <p className="text-xs text-muted-foreground">
              On transfer block for <span className="font-semibold text-foreground">{daysOnBlock} day{daysOnBlock === 1 ? "" : "s"}</span>
              {" — "}
              {daysUntilForfeit > 0 ? (
                <>forfeits in <span className="font-semibold text-destructive">{daysUntilForfeit} day{daysUntilForfeit === 1 ? "" : "s"}</span> if unclaimed</>
              ) : (
                <span className="font-semibold text-destructive">forfeiture pending — circle will be deleted soon</span>
              )}
            </p>
          </div>
          <Button size="sm" onClick={handleClaim} disabled={isClaiming} className="shrink-0">
            <Crown className="w-4 h-4 mr-1" />
            {isClaiming ? "Claiming..." : isOriginalOwner ? "Reclaim Ownership" : "Claim Ownership"}
          </Button>
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
