import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCircleContext } from "@/contexts/CircleContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, X, Check, Loader2 } from "lucide-react";
import { checkCircleCapacity } from "@/lib/circleLimits";
import UpgradePlanDialog from "@/components/circles/UpgradePlanDialog";

interface PendingInvite {
  id: string;
  circle_id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
  circles: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

interface PendingInvitesProps {
  compact?: boolean;
  onCountChange?: (count: number) => void;
}

const PendingInvites = ({ compact = false, onCountChange }: PendingInvitesProps) => {
  const { user } = useAuth();
  const { refetchCircles } = useCircleContext();
  const { toast } = useToast();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<{ plan: string; currentCount: number; limit: number; circleId: string }>({ plan: "free", currentCount: 0, limit: 8, circleId: "" });

  const fetchInvites = async () => {
    if (!user?.email) return;

    // Fetch invites and user's current circles in parallel
    const [invitesResult, membershipsResult, ownedResult] = await Promise.all([
      supabase
        .from("circle_invites")
        .select("id, circle_id, email, status, created_at, expires_at, circles(id, name, description)")
        .eq("email", user.email)
        .eq("status", "pending"),
      supabase
        .from("circle_memberships")
        .select("circle_id")
        .eq("user_id", user.id),
      supabase
        .from("circles")
        .select("id")
        .eq("owner_id", user.id),
    ]);

    if (!invitesResult.error && invitesResult.data) {
      // Build set of circles user already belongs to
      const joinedCircleIds = new Set<string>();
      membershipsResult.data?.forEach((m) => joinedCircleIds.add(m.circle_id));
      ownedResult.data?.forEach((c) => joinedCircleIds.add(c.id));

      const valid = (invitesResult.data as unknown as PendingInvite[]).filter(
        (inv) =>
          new Date(inv.expires_at) > new Date() &&
          inv.circles != null &&
          !joinedCircleIds.has(inv.circle_id)
      );
      // Deduplicate by circle_id — keep most recent invite per circle
      const byCircle = new Map<string, PendingInvite>();
      valid.forEach((inv) => {
        const existing = byCircle.get(inv.circle_id);
        if (!existing || new Date(inv.created_at) > new Date(existing.created_at)) {
          byCircle.set(inv.circle_id, inv);
        }
      });
      const deduped = Array.from(byCircle.values());
      setInvites(deduped);
      onCountChange?.(deduped.length);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInvites();
  }, [user]);

  const handleAccept = async (invite: PendingInvite) => {
    if (!user) return;
    setProcessingIds((prev) => new Set(prev).add(invite.id));

    // Check member limit before accepting
    if (invite.circles) {
      const { data: circleDetail } = await supabase
        .from("circles")
        .select("owner_id")
        .eq("id", invite.circle_id)
        .maybeSingle();

      if (circleDetail) {
        const capacity = await checkCircleCapacity(invite.circle_id, circleDetail.owner_id);
        if (capacity.isFull) {
          setUpgradeInfo({ plan: capacity.plan, currentCount: capacity.currentCount, limit: capacity.limit, circleId: invite.circle_id });
          setUpgradeDialogOpen(true);
          setProcessingIds((prev) => { const s = new Set(prev); s.delete(invite.id); return s; });
          return;
        }
      }
    }

    const { error: joinError } = await supabase
      .from("circle_memberships")
      .insert({ circle_id: invite.circle_id, user_id: user.id, role: "member" });

    if (joinError) {
      toast({ title: "Error", description: "Failed to join circle.", variant: "destructive" });
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(invite.id); return s; });
      return;
    }

    await supabase
      .from("circle_invites")
      .update({ status: "accepted" })
      .eq("circle_id", invite.circle_id)
      .eq("email", user.email!)
      .eq("status", "pending");

    const updated = invites.filter((i) => i.circle_id !== invite.circle_id);
    setInvites(updated);
    onCountChange?.(updated.length);
    toast({ title: "Joined!", description: `You've joined "${invite.circles?.name}".` });
    await refetchCircles();
    setProcessingIds((prev) => { const s = new Set(prev); s.delete(invite.id); return s; });
  };

  const handleDecline = async (invite: PendingInvite) => {
    if (!user?.email) return;
    setProcessingIds((prev) => new Set(prev).add(invite.id));

    const { error } = await supabase
      .from("circle_invites")
      .update({ status: "declined" })
      .eq("id", invite.id);

    if (error) {
      console.error("Decline invite error:", error);
      toast({ title: "Error", description: error.message || "Failed to decline invite.", variant: "destructive" });
    } else {
      const updated = invites.filter((i) => i.circle_id !== invite.circle_id);
      setInvites(updated);
      onCountChange?.(updated.length);
      toast({ title: "Invite declined" });
    }
    setProcessingIds((prev) => { const s = new Set(prev); s.delete(invite.id); return s; });
  };

  if (isLoading || invites.length === 0) return (
    <>
      <UpgradePlanDialog
        isOpen={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        currentPlan={upgradeInfo.plan}
        currentCount={upgradeInfo.currentCount}
        limit={upgradeInfo.limit}
        circleId={upgradeInfo.circleId}
      />
    </>
  );

  return (
    <>
      <div className={compact ? "space-y-2" : "space-y-3 mb-8"}>
        {invites.map((invite) => {
          const isProcessing = processingIds.has(invite.id);
          return (
            <Card key={invite.id} className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      {compact ? "Invite:" : "You've been invited to join"}{" "}
                      <span className="font-semibold">{invite.circles?.name ?? "a circle"}</span>
                    </p>
                    {invite.circles?.description && !compact && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {invite.circles.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(invite)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(invite)}
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <UpgradePlanDialog
        isOpen={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        currentPlan={upgradeInfo.plan}
        currentCount={upgradeInfo.currentCount}
        limit={upgradeInfo.limit}
        circleId={upgradeInfo.circleId}
      />
    </>
  );
};

export default PendingInvites;
