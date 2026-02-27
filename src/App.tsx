import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
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
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import About from "./pages/About";
import Careers from "./pages/Careers";
import Blog from "./pages/Blog";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="/store" element={<Store />} />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/blog" element={<Blog />} />
            
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
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
