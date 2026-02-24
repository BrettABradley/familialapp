import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CircleProvider, useCircleContext } from "@/contexts/CircleContext";
import { CircleHeader } from "@/components/layout/CircleHeader";
import { CircleHeaderSkeleton } from "@/components/layout/CircleHeaderSkeleton";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import TransferBlockBanner from "@/components/circles/TransferBlockBanner";

function AppLayoutContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: circlesLoading } = useCircleContext();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isProfileRoute = location.pathname.startsWith("/profile") || location.pathname === "/settings";

  useEffect(() => {
    if (!authLoading && !user) {
      // Preserve return URL so checkout session_id isn't lost during auth redirect
      const fullPath = window.location.pathname + window.location.search;
      if (fullPath !== "/" && fullPath !== "/auth") {
        localStorage.setItem("postAuthRedirect", fullPath);
      }
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
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
    </div>
  );
}

export function AppLayout() {
  return (
    <CircleProvider>
      <AppLayoutContent />
    </CircleProvider>
  );
}
