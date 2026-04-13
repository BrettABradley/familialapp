import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, UserCircle, Users } from "lucide-react";

interface OnboardingFlowProps {
  hasAvatar: boolean;
  hasBio: boolean;
  hasCircles: boolean;
}

export function OnboardingFlow({ hasAvatar, hasBio, hasCircles }: OnboardingFlowProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("onboarding_dismissed") === "true";
  });

  // Don't show if everything is complete or previously dismissed
  const isComplete = hasAvatar && hasBio && hasCircles;
  if (isComplete || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem("onboarding_dismissed", "true");
    setDismissed(true);
  };

  const steps = [
    {
      done: hasAvatar,
      icon: Camera,
      title: "Add a profile photo",
      description: "Help your family recognize you",
      action: () => { handleDismiss(); navigate("/settings"); },
    },
    {
      done: hasBio,
      icon: UserCircle,
      title: "Tell us about yourself",
      description: "Add your display name and a short bio",
      action: () => { handleDismiss(); navigate("/settings"); },
    },
    {
      done: hasCircles,
      icon: Users,
      title: "Create or join a circle",
      description: "Start connecting with your family",
      action: () => { handleDismiss(); navigate("/circles"); },
    },
  ];

  const nextStep = steps.find((s) => !s.done);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Welcome to Familial! 👋</DialogTitle>
          <DialogDescription>
            Let's get you set up in a few quick steps.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                step.done
                  ? "bg-muted/50 border-border opacity-60"
                  : step === nextStep
                  ? "bg-primary/5 border-primary/20"
                  : "border-border"
              }`}
            >
              <step.icon className={`w-5 h-5 ${step.done ? "text-muted-foreground" : "text-primary"}`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${step.done ? "line-through" : ""}`}>{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {step.done ? (
                <span className="text-xs text-muted-foreground">Done ✓</span>
              ) : step === nextStep ? (
                <Button size="sm" variant="default" onClick={step.action}>
                  Go
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
