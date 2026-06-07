import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, UserCircle, Users, Check } from "lucide-react";

interface OnboardingFlowProps {
  hasAvatar: boolean;
  hasDisplayName: boolean;
  hasCircles: boolean;
}

const PERMANENT_KEY = "onboarding_dismissed";
const SESSION_KEY = "onboarding_hidden_this_session";

export function OnboardingFlow({ hasAvatar, hasDisplayName, hasCircles }: OnboardingFlowProps) {
  const navigate = useNavigate();
  const isComplete = hasAvatar && hasDisplayName && hasCircles;

  const [hidden, setHidden] = useState(() => {
    if (localStorage.getItem(PERMANENT_KEY) === "true") return true;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return true;
    return false;
  });

  // Once everything is complete, permanently dismiss so we don't reappear.
  if (isComplete) {
    if (localStorage.getItem(PERMANENT_KEY) !== "true") {
      try { localStorage.setItem(PERMANENT_KEY, "true"); } catch {}
    }
    return null;
  }
  if (hidden) return null;

  const handleSessionDismiss = () => {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    setHidden(true);
  };

  const go = (path: string) => {
    handleSessionDismiss();
    navigate(path);
  };

  const steps = [
    {
      done: hasAvatar,
      icon: Camera,
      title: "Add a photo of yourself",
      description: "So Mom, Dad, and the kids know it's you.",
      action: () => go("/settings?open=avatar"),
    },
    {
      done: hasDisplayName,
      icon: UserCircle,
      title: "What should family call you?",
      description: "Set the name your family will see — first name, nickname, 'Grammy', whatever feels right.",
      action: () => go("/settings?focus=displayName"),
    },
    {
      done: hasCircles,
      icon: Users,
      title: "Start your first circle",
      description: "A circle is your private family space. Invite your people next.",
      action: () => go("/circles?open=create"),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);
  const progressPct = (completedCount / steps.length) * 100;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleSessionDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Let's get your family together</DialogTitle>
          <DialogDescription>
            Three small steps so the people who matter most can find you here.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{completedCount} of {steps.length} done</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="space-y-3 py-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isNext = step === nextStep;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  step.done
                    ? "bg-muted/40 border-border"
                    : isNext
                    ? "bg-primary/5 border-primary/20"
                    : "border-border"
                }`}
              >
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  step.done ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                }`}>
                  {step.done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {!step.done && isNext && (
                  <Button size="sm" onClick={step.action}>
                    Go
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleSessionDismiss}>
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
