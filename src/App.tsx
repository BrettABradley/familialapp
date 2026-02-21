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
import Events from "./pages/Events";
import Fridge from "./pages/Fridge";
import Notifications from "./pages/Notifications";

import Albums from "./pages/Albums";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";

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
            <Route path="/store" element={<Store />} />
            
            {/* Authenticated routes with persistent layout */}
            <Route element={<AppLayout />}>
              <Route path="/feed" element={<Feed />} />
              <Route path="/circles" element={<Circles />} />
              <Route path="/profile" element={<Profile />} />
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
