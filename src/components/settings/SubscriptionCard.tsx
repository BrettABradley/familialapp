import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserPlan {
  plan: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  pending_plan: string | null;
  max_circles: number;
}

interface OwnedCircle {
  id: string;
  name: string;
  memberCount: number;
}

const PLAN_LIMITS: Record<string, number> = { free: 1, family: 2, extended: 3 };

const SubscriptionCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [planData, setPlanData] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [cancelDowngradeLoading, setCancelDowngradeLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: "cancel" | "downgrade" } | null>(null);
  const [cancelDowngradeDialog, setCancelDowngradeDialog] = useState(false);
  const [affectedCircles, setAffectedCircles] = useState<OwnedCircle[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_plans")
      .select("plan, cancel_at_period_end, current_period_end, pending_plan, max_circles")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setPlanData(data as unknown as UserPlan);
        setLoading(false);
      });
  }, [user]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const planBadgeVariant = (plan: string): "default" | "secondary" | "destructive" => {
    if (plan === "extended") return "default";
    if (plan === "family") return "secondary";
    return "secondary";
  };

  const fetchAffectedCircles = async (targetPlan: string): Promise<OwnedCircle[]> => {
    if (!user) return [];
    const targetLimit = PLAN_LIMITS[targetPlan] ?? 1;

    const { data: circles } = await supabase
      .from("circles")
      .select("id, name, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    if (!circles || circles.length <= targetLimit) return [];

    const overflow = circles.slice(targetLimit);
    const withCounts = await Promise.all(
      overflow.map(async (c) => {
        const { count } = await supabase
          .from("circle_memberships")
          .select("id", { count: "exact", head: true })
          .eq("circle_id", c.id);
        return { id: c.id, name: c.name, memberCount: (count ?? 0) + 1 };
      })
    );
    return withCounts;
  };

  const openConfirmDialog = async (action: "cancel" | "downgrade") => {
    const targetPlan = action === "cancel" ? "free" : "family";
    const circles = await fetchAffectedCircles(targetPlan);
    setAffectedCircles(circles);
    setConfirmDialog({ open: true, action });
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to open billing portal.", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const createRescueOffers = async (targetPlan: string) => {
    if (!user || !planData?.current_period_end || affectedCircles.length === 0) return;

    for (const circle of affectedCircles) {
      // Create rescue offer
      await supabase.from("circle_rescue_offers").insert({
        circle_id: circle.id,
        current_owner: user.id,
        deadline: planData.current_period_end,
        status: "open",
      } as any);

      // Notify all members
      const { data: members } = await supabase
        .from("circle_memberships")
        .select("user_id")
        .eq("circle_id", circle.id);

      if (members) {
        const displayName = (await supabase.from("profiles").select("display_name").eq("user_id", user.id).single()).data?.display_name || "The owner";
        const notifications = members
          .filter((m) => m.user_id !== user.id)
          .map((m) => ({
            user_id: m.user_id,
            type: "circle_rescue",
            title: "Circle needs a new owner",
            message: `${displayName} is downgrading their plan. "${circle.name}" will become read-only on ${formatDate(planData.current_period_end)} unless someone takes over.`,
            related_circle_id: circle.id,
            link: `/circles?rescue=${circle.id}`,
          }));

        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
      }
    }
  };

  const handleCancelConfirm = async () => {
    setCancelLoading(true);
    try {
      await createRescueOffers("free");
      const { data, error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      if (data?.success) {
        setPlanData((prev) => prev ? { ...prev, cancel_at_period_end: true, current_period_end: data.current_period_end } : prev);
        toast({ title: "Subscription canceled", description: `You'll keep access until ${formatDate(data.current_period_end)}.` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to cancel.", variant: "destructive" });
    } finally {
      setCancelLoading(false);
      setConfirmDialog(null);
    }
  };

  const handleDowngradeConfirm = async () => {
    setDowngradeLoading(true);
    try {
      await createRescueOffers("family");
      const { data, error } = await supabase.functions.invoke("downgrade-subscription");
      if (error) throw error;
      if (data?.success) {
        setPlanData((prev) => prev ? { ...prev, pending_plan: "family", current_period_end: data.current_period_end } : prev);
        toast({ title: "Downgrade scheduled", description: `Your plan will switch to Family on ${formatDate(data.current_period_end)}.` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to downgrade.", variant: "destructive" });
    } finally {
      setDowngradeLoading(false);
      setConfirmDialog(null);
    }
  };

  const handleReactivate = async () => {
    setReactivateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reactivate-subscription");
      if (error) throw error;
      if (data?.success) {
        setPlanData((prev) => prev ? { ...prev, cancel_at_period_end: false, pending_plan: null, current_period_end: data.current_period_end } : prev);
        toast({ title: "Subscription reactivated!", description: "Your plan will continue as normal." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to reactivate.", variant: "destructive" });
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleCancelDowngrade = async () => {
    setCancelDowngradeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-downgrade");
      if (error) throw error;
      if (data?.success) {
        setPlanData((prev) => prev ? { ...prev, plan: "extended", pending_plan: null, current_period_end: data.current_period_end, max_circles: 3 } : prev);
        toast({ title: "Downgrade canceled", description: "You're back on the Extended plan. No additional charges." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to cancel downgrade.", variant: "destructive" });
    } finally {
      setCancelDowngradeLoading(false);
      setCancelDowngradeDialog(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-7 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!planData) return null;

  const isAdmin = planData.plan === "admin";
  const isPaid = planData.plan !== "free" && !isAdmin;
  const isExtended = planData.plan === "extended";
  const dialogAction = confirmDialog?.action;
  const targetPlanName = dialogAction === "cancel" ? "Free" : "Family";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl flex items-center gap-3">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">Current Plan</span>
            <Badge variant={planBadgeVariant(planData.plan)} className="capitalize">
              {planData.plan}
            </Badge>
            {planData.pending_plan && (
              <Badge variant="outline" className="capitalize">
                → {planData.pending_plan} on {formatDate(planData.current_period_end)}
              </Badge>
            )}
          </div>

          {isPaid && planData.current_period_end && (
            <div className="text-sm text-muted-foreground">
              {planData.cancel_at_period_end ? (
                <span className="text-destructive font-medium">
                  Canceling on {formatDate(planData.current_period_end)}
                </span>
              ) : (
                <span>Renews on {formatDate(planData.current_period_end)}</span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {isPaid && (
              <Button variant="outline" onClick={handleManageBilling} disabled={portalLoading} className="w-full">
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                Manage Billing
              </Button>
            )}

            {isExtended && !planData.cancel_at_period_end && !planData.pending_plan && (
              <Button variant="outline" onClick={() => openConfirmDialog("downgrade")} disabled={downgradeLoading} className="w-full">
                Downgrade to Family
              </Button>
            )}

            {planData.pending_plan && !planData.cancel_at_period_end && (
              <Button variant="default" onClick={() => setCancelDowngradeDialog(true)} disabled={cancelDowngradeLoading} className="w-full">
                {cancelDowngradeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Cancel Downgrade
              </Button>
            )}

            {isPaid && planData.cancel_at_period_end && (
              <Button variant="default" onClick={handleReactivate} disabled={reactivateLoading} className="w-full">
                {reactivateLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Reactivate Subscription
              </Button>
            )}

            {isPaid && !planData.cancel_at_period_end && (
              <Button variant="outline" onClick={() => openConfirmDialog("cancel")} disabled={cancelLoading} className="w-full text-destructive hover:text-destructive">
                Cancel Membership
              </Button>
            )}

            {!isPaid && !isAdmin && (
              <Button onClick={() => navigate("/#pricing")} className="w-full">
                Upgrade Plan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmDialog?.open ?? false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === "cancel" ? "Cancel your subscription?" : "Downgrade to Family?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You'll keep full access to your current plan until{" "}
                  {formatDate(planData.current_period_end)}. After that, your plan will switch to{" "}
                  {targetPlanName}.
                </p>
                {affectedCircles.length > 0 && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="font-medium text-foreground text-sm">
                      These circles will become read-only:
                    </p>
                    <ul className="space-y-1">
                      {affectedCircles.map((c) => (
                        <li key={c.id} className="text-sm flex justify-between">
                          <span className="font-medium text-foreground">{c.name}</span>
                          <span className="text-muted-foreground">{c.memberCount} members</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground pt-1">
                      Members will be notified and given the option to take over ownership and billing.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Current Plan</AlertDialogCancel>
            <AlertDialogAction
              onClick={dialogAction === "cancel" ? handleCancelConfirm : handleDowngradeConfirm}
              disabled={cancelLoading || downgradeLoading}
            >
              {(cancelLoading || downgradeLoading) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelDowngradeDialog}
        onOpenChange={(open) => !open && setCancelDowngradeDialog(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your downgrade?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure? You'll continue on the <strong>Extended</strong> plan at <strong>$15/month</strong>, charged on your original billing schedule.
                </p>
                <p className="text-sm text-muted-foreground">
                  No additional charges will be made right now.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Downgrade</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelDowngrade} disabled={cancelDowngradeLoading}>
              {cancelDowngradeLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Stay on Extended
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SubscriptionCard;
