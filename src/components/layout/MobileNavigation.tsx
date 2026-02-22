import { Link, useLocation } from "react-router-dom";
import { Home, Pin, Calendar, MoreHorizontal, Settings, Users, Image, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { to: "/circles", icon: Users, label: "Circles" },
  { to: "/feed", icon: Home, label: "Feed" },
  { to: "/fridge", icon: Pin, label: "Fridge" },
  { to: "/events", icon: Calendar, label: "Events" },
];

const moreItems = [
  { to: "/albums", icon: Image, label: "Albums" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNavigation() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!isMobile) return null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-safe">
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
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] transition-colors ${
                moreItems.some((item) => isActive(item.to))
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-xs mt-1">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 py-6">
              {moreItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl min-h-[80px] transition-colors ${
                    isActive(item.to)
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary/50 text-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="w-6 h-6 mb-2" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
