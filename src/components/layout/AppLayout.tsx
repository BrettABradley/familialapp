import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CircleProvider, useCircleContext } from "@/contexts/CircleContext";
import { CircleHeader } from "@/components/layout/CircleHeader";
import { CircleHeaderSkeleton } from "@/components/layout/CircleHeaderSkeleton";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import TransferBlockBanner from "@/components/circles/TransferBlockBanner";
import { TermsAcceptanceGate } from "@/components/shared/TermsAcceptanceGate";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { OnboardingFlow } from "@/components/shared/OnboardingFlow";

function AppLayoutContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: circlesLoading, profile } = useCircleContext();
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

  const handleSignOut = async () => {
    signingOut.current = true;
    localStorage.removeItem("selectedCircle");
    localStorage.removeItem("postAuthRedirect");
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

  return (
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
            hasBio={!!profile.bio}
            hasCircles={circles.length > 0}
          />
        )}
      </div>
    </TermsAcceptanceGate>
  );
}

export function AppLayout() {
  return (
    <CircleProvider>
      <AppLayoutContent />
    </CircleProvider>
  );
}
