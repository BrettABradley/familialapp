import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowUp, Plus, Loader2 } from "lucide-react";
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
}

interface UpgradePreview {
  planName: string;
  priceId: string;
  proratedAmount: number;
  newMonthlyPrice: number;
  nextBillingDate: string;
}

const UpgradePlanDialog = ({ isOpen, onClose, currentPlan, currentCount, limit, circleId }: UpgradePlanDialogProps) => {
  const { toast } = useToast();
  const [loadingOption, setLoadingOption] = useState<string | null>(null);
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const handleCheckout = async (priceId: string, mode: "subscription" | "payment", optionKey: string) => {
    setLoadingOption(optionKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, mode, circleId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout.", variant: "destructive" });
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

  const options = [];

  if (currentPlan === "free") {
    options.push({
      key: "family",
      title: "Family Plan",
      price: "$7/month",
      description: "Up to 20 members per circle, 2 circles",
      action: () => handleCheckout(PRICES.family, "subscription", "family"),
      icon: <ArrowUp className="w-4 h-4" />,
    });
    options.push({
      key: "extended",
      title: "Extended Plan",
      price: "$15/month",
      description: "Up to 35 members per circle, 3 circles",
      action: () => handleCheckout(PRICES.extended, "subscription", "extended"),
      icon: <ArrowUp className="w-4 h-4" />,
    });
  } else if (currentPlan === "family") {
    options.push({
      key: "extended",
      title: "Upgrade to Extended",
      price: "$15/month",
      description: "Up to 35 members per circle, 3 circles",
      action: () => handleUpgradePreview(PRICES.extended, "extended"),
      icon: <ArrowUp className="w-4 h-4" />,
    });
  }

  // Extra members available on ALL tiers
  options.push({
    key: "extra",
    title: "Add 7 Extra Members",
    price: "$5 one-time",
    description: "Adds 7 more member slots to this circle",
    action: () => handleCheckout(PRICES.extraMembers, "payment", "extra"),
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
                </CardContent>
              </Card>
            ))}

            {options.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Contact support for additional member capacity.
              </p>
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
