import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { CircleProvider, useCircleContext } from "@/contexts/CircleContext";
import { CircleHeader } from "@/components/layout/CircleHeader";
import { CircleHeaderSkeleton } from "@/components/layout/CircleHeaderSkeleton";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import TransferBlockBanner from "@/components/circles/TransferBlockBanner";
import { TermsAcceptanceGate } from "@/components/shared/TermsAcceptanceGate";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { OnboardingFlow } from "@/components/shared/OnboardingFlow";
import { UpdatePrompt } from "@/components/shared/UpdatePrompt";
import { TwoFactorGate, clearTwoFactorVerified } from "@/components/auth/TwoFactorGate";
import { useDeepLinkCircleSync } from "@/hooks/useDeepLinkCircleSync";
import { Button } from "@/components/ui/button";
import { MailCheck, CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo.png";

const VERIFIED_FLAG = "familial:emailJustVerified";

function UnverifiedEmailGate({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const { resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // If the user verified in another tab/browser while this device was
  // already signed in, the cached JWT still says email_confirmed_at=null.
  // Force a session refresh on mount + whenever the window regains focus
  // so the gate disappears automatically once Supabase confirms.
  const refresh = async () => {
    setRefreshing(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.refreshSession();
    } catch { /* non-fatal */ }
    setRefreshing(false);
  };

  useEffect(() => {
    refresh();
    const onFocus = () => { refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const resend = async () => {
    setSending(true); setError(null);
    const { error } = await resendVerification(email);
    setSending(false);
    if (error) setError(error.message); else setSent(true);
  };

  return (
    <div
      className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <img src={logo} alt="Familial" className="h-16 w-auto mb-6 opacity-80" />
      <div className="rounded-full bg-muted p-4 mb-4">
        <MailCheck className="h-10 w-10 text-foreground" strokeWidth={1.5} />
      </div>
      <h1 className="font-serif text-2xl text-foreground mb-2">Verify your email</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        We sent a verification link to <span className="font-medium text-foreground">{email}</span>. Tap it to finish setting up your account.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={refresh} disabled={refreshing}>
          {refreshing ? "Checking…" : "I already verified — refresh"}
        </Button>
        <Button onClick={resend} disabled={sending || sent} variant="outline">
          {sent ? "Email sent — check your inbox" : sending ? "Sending…" : "Resend verification email"}
        </Button>
        <Button onClick={onSignOut} variant="ghost">Use a different email</Button>
      </div>
      {error && <p className="text-sm text-destructive mt-4 max-w-sm">{error}</p>}
    </div>
  );
}




function AppLayoutContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: circlesLoading, profile, lockCircleSwitcher } = useCircleContext();
  useDeepLinkCircleSync();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isProfileRoute = location.pathname.startsWith("/profile") || location.pathname === "/settings";

  // Track whether a sign-out is in progress to prevent the useEffect
  // from doing a soft navigate that races with the hard redirect.
  const signingOut = useRef(false);

  useEffect(() => {
    if (signingOut.current) return;
    if (!authLoading && !user) {
      // Preserve return URL so checkout session_id isn't lost during auth redirect
      const fullPath = window.location.pathname + window.location.search;
      const isExcluded = fullPath === "/" || fullPath === "/auth" || fullPath.startsWith("/settings") || fullPath.startsWith("/profile");
      if (!isExcluded) {
        localStorage.setItem("postAuthRedirect", fullPath);
      }
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // One-shot "Email verified" flash. The flag is set either on the web
  // success page (post hand-off back to the app) or by AuthCallback in the
  // native flow before it routes to /circles.
  useEffect(() => {
    if (!user || !user.email_confirmed_at) return;
    let flagged = false;
    try {
      flagged = localStorage.getItem(VERIFIED_FLAG) === "1";
    } catch {
      // non-fatal
    }
    if (!flagged) return;
    try { localStorage.removeItem(VERIFIED_FLAG); } catch { /* non-fatal */ }
    toast.success("Email verified — welcome to Familial", {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      duration: 3000,
    });
  }, [user]);

  const handleSignOut = async () => {
    signingOut.current = true;
    localStorage.removeItem("selectedCircle");
    localStorage.removeItem("postAuthRedirect");
    clearTwoFactorVerified();
    await signOut();
    window.location.href = "/auth";
  };


  // Show nothing while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If not authenticated, don't render (redirect will happen)
  if (!user) {
    return null;
  }

  // Email verification gate. Existing accounts all have email_confirmed_at set
  // by Supabase backfill, so they pass straight through. New accounts that
  // somehow obtain a session without confirming see this screen instead of
  // the app. Pairs with the signUp() safety-net signOut in useAuth.
  if (!user.email_confirmed_at) {
    return <UnverifiedEmailGate email={user.email ?? ""} onSignOut={handleSignOut} />;
  }

  return (
    <TwoFactorGate>
      <TermsAcceptanceGate>
        <div className="min-h-screen bg-background pb-20 md:pb-0">
          <OfflineBanner />
          {circlesLoading ? (
            <CircleHeaderSkeleton />
          ) : (
            <CircleHeader
              circles={circles}
              selectedCircle={selectedCircle}
              onCircleChange={setSelectedCircle}
              onSignOut={handleSignOut}
              overrideLabel={isProfileRoute ? "All Circles" : undefined}
              lockCircle={lockCircleSwitcher}
            />
          )}
          <main key={location.pathname} className="animate-page-fade-in">
            <div className="container mx-auto px-4 mt-4">
              <TransferBlockBanner />
            </div>
            <Outlet />
          </main>
          <MobileNavigation />
          {!circlesLoading && profile && (
            <OnboardingFlow
              hasAvatar={!!profile.avatar_url}
              hasDisplayName={!!profile.display_name}
              hasCircles={circles.length > 0}
            />
          )}
          <UpdatePrompt />
        </div>
      </TermsAcceptanceGate>
    </TwoFactorGate>
  );

}

export function AppLayout() {
  return (
    <CircleProvider>
      <AppLayoutContent />
    </CircleProvider>
  );
}
