import { Link, useLocation } from "react-router-dom";
import { Home, Calendar, Users, Image, MessageSquare, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { to: "/circles", icon: Users, label: "Circles" },
  { to: "/feed", icon: Home, label: "Feed" },
  { to: "/events", icon: Calendar, label: "Events" },
  { to: "/albums", icon: Image, label: "Albums" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function MobileNavigation() {
  const isMobile = useIsMobile();
  const location = useLocation();

  if (!isMobile) return null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] transition-colors ${
              isActive(item.to)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
