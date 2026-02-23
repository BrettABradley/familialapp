import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowUp, Plus, Loader2 } from "lucide-react";

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

const UpgradePlanDialog = ({ isOpen, onClose, currentPlan, currentCount, limit, circleId }: UpgradePlanDialogProps) => {
  const { toast } = useToast();
  const [loadingOption, setLoadingOption] = useState<string | null>(null);

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
      action: () => handleCheckout(PRICES.extended, "subscription", "extended"),
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Users className="w-5 h-5" />
            Circle Member Limit Reached
          </DialogTitle>
          <DialogDescription>
            This circle has {currentCount} of {limit} members. Upgrade to add more members.
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
  );
};

export default UpgradePlanDialog;
