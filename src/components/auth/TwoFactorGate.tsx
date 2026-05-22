import { useEffect, useRef, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const sessionKey = (uid: string) => `twoFactorVerified:${uid}`;

// 2FA verification is persisted per-device in localStorage so users only need
// to re-verify after an explicit sign-out (not on tab close / app relaunch).
export function clearTwoFactorVerified() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("twoFactorVerified:")) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith("twoFactorVerified:")) sessionStorage.removeItem(k);
    });
  } catch {}
}

export function TwoFactorGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const sentRef = useRef(false);

  // Determine whether 2FA is required for this user / session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setChecking(false);
        return;
      }
      // Already verified on this device?
      if (localStorage.getItem(sessionKey(user.id)) || sessionStorage.getItem(sessionKey(user.id))) {
        if (!cancelled) {
          setVerified(true);
          setChecking(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("two_factor_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const enabled = !!(data as any)?.two_factor_enabled;
      setRequired(enabled);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Send the code exactly once when challenge is shown.
  useEffect(() => {
    if (!user || verified || !required || sentRef.current) return;
    sentRef.current = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("send-2fa-code");
      if (error || !data?.success) {
        toast({
          title: "Couldn't send code",
          description: "Please try resending or sign out.",
          variant: "destructive",
        });
      }
    })();
  }, [user, verified, required, toast]);

  const handleVerify = async () => {
    if (code.length !== 6 || !user) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("verify-2fa-code", {
      body: { code },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast({
        title: "Invalid code",
        description: data?.error || "Please check your email and try again.",
        variant: "destructive",
      });
      return;
    }
    localStorage.setItem(sessionKey(user.id), "1");
    setVerified(true);
    toast({ title: "Verified", description: "Welcome back." });
  };

  const handleResend = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-2fa-code");
    setBusy(false);
    if (error || !data?.success) {
      toast({ title: "Couldn't resend code", variant: "destructive" });
    } else {
      toast({ title: "New code sent", description: "Check your email." });
    }
  };

  const handleCancel = async () => {
    clearTwoFactorVerified();
    await signOut();
    window.location.href = "/auth";
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!required || verified) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify it's you</CardTitle>
          <CardDescription>
            We sent a 6-digit verification code to your email. Enter it below to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-widest"
          />
          <Button className="w-full" disabled={code.length !== 6 || busy} onClick={handleVerify}>
            {busy ? "Verifying..." : "Verify"}
          </Button>
          <button
            type="button"
            onClick={handleResend}
            disabled={busy}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
          >
            Cancel & sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
