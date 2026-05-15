import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowUp, Plus, Loader2 } from "lucide-react";
import { openExternalUrl } from "@/lib/externalUrl";
import {
  isIOSNative,
  purchaseSubscription,
  purchaseConsumable,
  prewarmProducts,
  APPLE_PRODUCTS,
} from "@/lib/iapPurchase";
import SubscriptionDisclosure from "@/components/shared/SubscriptionDisclosure";
import { useCircleContext } from "@/contexts/CircleContext";
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

// Stripe price IDs
const PRICES = {
  family: "price_1T3N5bCiWDzualH5Cf7G7VsM",
  extended: "price_1T3N5nCiWDzualH5SBHxbHqo",
  extraMembers: "price_1T3N5zCiWDzualH52rsDSBlu",
};

interface UpgradePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  currentCount: number;
  limit: number;
  circleId: string;
  onPurchaseSuccess?: () => void | Promise<void>;
}

interface UpgradePreview {
  planName: string;
  priceId: string;
  proratedAmount: number;
  newMonthlyPrice: number;
  nextBillingDate: string;
}

const UpgradePlanDialog = ({ isOpen, onClose, currentPlan, currentCount, limit, circleId, onPurchaseSuccess }: UpgradePlanDialogProps) => {
  const { toast } = useToast();
  const { refetchUserPlan, refetchCircles } = useCircleContext();
  const [loadingOption, setLoadingOption] = useState<string | null>(null);
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [planSource, setPlanSource] = useState<string | null>(null);

  // Pre-warm StoreKit when dialog opens (iOS only) so products are ready
  // before the user taps a Buy/Upgrade button. Avoids 2.1(b) "Cannot find
  // product" rejections from App Review on cold-start sandboxes.
  useEffect(() => {
    if (isOpen && isIOSNative()) {
      prewarmProducts();
    }
  }, [isOpen]);

  // Detect existing subscription source so we can warn about cross-platform double-billing
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_plans")
        .select("source, plan")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && data.plan !== "free") setPlanSource(data.source ?? "stripe");
      else setPlanSource(null);
    })();
  }, [isOpen]);

  const onIOSPlatform = isIOSNative();
  const crossPlatformWarning =
    planSource === "apple" && !onIOSPlatform
      ? "You already have an active subscription through the App Store. Manage or change your plan in your iPhone's Settings → Apple ID → Subscriptions to avoid being billed twice."
      : planSource === "stripe" && onIOSPlatform
      ? "You already have an active subscription billed on the web. Manage or change your plan from familialmedia.com to avoid being billed twice."
      : null;

  const handleCheckout = async (priceId: string, mode: "subscription" | "payment", optionKey: string) => {
    setLoadingOption(optionKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, mode, circleId },
      });

      if (error) throw error;
      if (data?.url) {
        openExternalUrl(data.url);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout.", variant: "destructive" });
    } finally {
      setLoadingOption(null);
    }
  };

  const handleApplePlanPurchase = async (
    plan: "family" | "extended",
    optionKey: string
  ) => {
    setLoadingOption(optionKey);
    try {
      const success = await purchaseSubscription(APPLE_PRODUCTS[plan]);
      if (success) {
        // Refresh plan + circles so the UI reflects the new tier (e.g. Extended → 35 members)
        await Promise.all([refetchUserPlan(), refetchCircles()]);
        await onPurchaseSuccess?.();
        toast({
          title: "Plan upgraded!",
          description: `You're now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.`,
        });
        onClose();
      }
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message || "Could not complete purchase.", variant: "destructive" });
    } finally {
      setLoadingOption(null);
    }
  };

  const handleAppleExtraMembers = async (optionKey: string) => {
    setLoadingOption(optionKey);
    try {
      const success = await purchaseConsumable(APPLE_PRODUCTS.extraMembers, {
        circleId,
        kind: "extra_members",
      });
      if (success) {
        await Promise.all([refetchUserPlan(), refetchCircles()]);
        await onPurchaseSuccess?.();
        toast({ title: "Seats added!", description: "7 extra member slots added to this circle." });
        onClose();
      }
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message || "Could not complete purchase.", variant: "destructive" });
    } finally {
      setLoadingOption(null);
    }
  };

  const handleUpgradePreview = async (priceId: string, optionKey: string) => {
    setLoadingOption(optionKey);
    try {
      const { data, error } = await supabase.functions.invoke("preview-upgrade", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUpgradePreview({
        planName: data.plan_name,
        priceId,
        proratedAmount: data.prorated_amount,
        newMonthlyPrice: data.new_monthly_price,
        nextBillingDate: data.next_billing_date,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to preview upgrade.", variant: "destructive" });
    } finally {
      setLoadingOption(null);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradePreview) return;
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-subscription", {
        body: { priceId: upgradePreview.priceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.success) {
        toast({
          title: "Plan upgraded!",
          description: `You're now on the ${data.plan.charAt(0).toUpperCase() + data.plan.slice(1)} plan. A receipt has been sent to your email.`,
        });
        onClose();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to process upgrade.", variant: "destructive" });
    } finally {
      setUpgrading(false);
      setUpgradePreview(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  // On iOS native, all paid actions must use Apple IAP (App Store guideline 3.1.1).
  const onIOS = isIOSNative();

  const options = [];

  if (currentPlan === "free") {
    options.push({
      key: "family",
      title: "Family Plan",
      price: "$7/month",
      description: "Up to 20 members per circle, 2 circles",
      action: () =>
        onIOS
          ? handleApplePlanPurchase("family", "family")
          : handleCheckout(PRICES.family, "subscription", "family"),
      icon: <ArrowUp className="w-4 h-4" />,
    });
    options.push({
      key: "extended",
      title: "Extended Plan",
      price: "$15/month",
      description: "Up to 35 members per circle, 3 circles",
      action: () =>
        onIOS
          ? handleApplePlanPurchase("extended", "extended")
          : handleCheckout(PRICES.extended, "subscription", "extended"),
      icon: <ArrowUp className="w-4 h-4" />,
    });
  } else if (currentPlan === "family") {
    options.push({
      key: "extended",
      title: "Upgrade to Extended",
      price: "$15/month",
      description: "Up to 35 members per circle, 3 circles",
      action: () =>
        onIOS
          ? handleApplePlanPurchase("extended", "extended")
          : handleUpgradePreview(PRICES.extended, "extended"),
      icon: <ArrowUp className="w-4 h-4" />,
    });
  }

  // Extra members available on ALL tiers
  options.push({
    key: "extra",
    title: "Add 7 Extra Members",
    price: "$5 one-time",
    description: "Adds 7 more member slots to this circle",
    action: () =>
      onIOS
        ? handleAppleExtraMembers("extra")
        : handleCheckout(PRICES.extraMembers, "payment", "extra"),
    icon: <Plus className="w-4 h-4" />,
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Users className="w-5 h-5" />
              Upgrade Your Circle
            </DialogTitle>
            <DialogDescription>
              Hit your member limit or just want more room to grow? We've got you covered.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground p-3 rounded-md bg-secondary/50">
              <span>Current plan</span>
              <Badge variant="secondary" className="capitalize">{currentPlan}</Badge>
            </div>

            {options.map((option) => (
              <Card key={option.key} className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{option.title}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">{option.price}</span>
                      <Button size="sm" onClick={option.action} disabled={loadingOption !== null}>
                        {loadingOption === option.key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          option.icon
                        )}
                      </Button>
                    </div>
                  </div>
                  {isIOSNative() && option.key !== "extra" && (
                    <SubscriptionDisclosure variant="compact" className="mt-3" />
                  )}
                </CardContent>
              </Card>
            ))}

            {options.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Contact support for additional member capacity.
              </p>
            )}

            {isIOSNative() && (
              <SubscriptionDisclosure variant="full" className="mt-2" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Preview Confirmation */}
      <AlertDialog
        open={upgradePreview !== null}
        onOpenChange={(open) => !open && setUpgradePreview(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Upgrade to {upgradePreview?.planName}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">Due now (prorated)</span>
                    <span className="text-foreground font-semibold">
                      ${((upgradePreview?.proratedAmount ?? 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Starting {upgradePreview?.nextBillingDate ? formatDate(upgradePreview.nextBillingDate) : "next billing date"}
                    </span>
                    <span className="text-muted-foreground">
                      ${((upgradePreview?.newMonthlyPrice ?? 0) / 100).toFixed(2)}/month
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  You'll be charged the prorated difference for the remainder of your current billing period. After that, your monthly rate adjusts to the new plan price.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpgrade} disabled={upgrading}>
              {upgrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm & Pay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UpgradePlanDialog;
