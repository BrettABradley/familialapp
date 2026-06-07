import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { AppLayout } from "@/components/layout/AppLayout";
import { UpdateGate } from "@/components/UpdateGate";
import Index from "./pages/Index";
import Unsubscribe from "./pages/Unsubscribe";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Feed from "./pages/Feed";
import Circles from "./pages/Circles";
import Store from "./pages/Store";
import Profile from "./pages/Profile";
import ProfileView from "./pages/ProfileView";
import Settings from "./pages/Settings";
import Events from "./pages/Events";
import Fridge from "./pages/Fridge";
import Notifications from "./pages/Notifications";

import Albums from "./pages/Albums";
import Messages from "./pages/Messages";
import ResetPassword from "./pages/ResetPassword";
import Upgrade from "./pages/Upgrade";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Appeal from "./pages/Appeal";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import About from "./pages/About";
import Careers from "./pages/Careers";
import Blog from "./pages/Blog";
import Support from "./pages/Support";
import DeleteAccount from "./pages/DeleteAccount";

const queryClient = new QueryClient();

const NativeUrlOpenBridge = () => {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const handle = await CapApp.addListener("appUrlOpen", (event) => {
          try {
            const u = new URL(event.url);
            // Universal link: https://www.familialmedia.com/auth/callback?...
            // Custom scheme fallback also routes through here.
            if (u.pathname.startsWith("/auth/callback")) {
              const target = u.pathname + u.search + u.hash;
              navigate(target, { replace: true });
            }
          } catch (e) {
            console.warn("[appUrlOpen] could not parse URL", event.url, e);
          }
        });
        remove = () => handle.remove();
      } catch (e) {
        console.warn("[appUrlOpen] listener setup failed", e);
      }
    })();
    return () => { remove?.(); };
  }, [navigate]);
  return null;
};

const App = () => {
  useVisualViewport();
  useEffect(() => {
    console.log("[boot] App effect mounted");
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/splash-screen")
        .then(({ SplashScreen }) =>
          SplashScreen.hide().catch((e) => console.warn("[boot] splash hide (App) failed", e))
        )
        .catch((e) => console.warn("[boot] splash plugin load (App) failed", e));
    }
  }, []);
  return (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <NativeUrlOpenBridge />
          <UpdateGate>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/store" element={<Store />} />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/support" element={<Support />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/appeal" element={<Appeal />} />
            
            {/* Authenticated routes with persistent layout */}
            <Route element={<AppLayout />}>
              <Route path="/feed" element={<Feed />} />
              <Route path="/circles" element={<Circles />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:userId" element={<ProfileView />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/events" element={<Events />} />
              <Route path="/fridge" element={<Fridge />} />
              <Route path="/notifications" element={<Notifications />} />
              
              <Route path="/albums" element={<Albums />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/upgrade" element={<Upgrade />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </UpdateGate>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
  );
};

export default App;
