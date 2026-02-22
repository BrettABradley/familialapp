import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { LogOut, Users, Calendar, Settings, Pin, MessageSquare, Image, Menu, Home, User } from "lucide-react";
import icon from "@/assets/icon.png";
import { useIsMobile } from "@/hooks/use-mobile";

interface Circle {
  id: string;
  name: string;
  owner_id?: string;
}

interface CircleHeaderProps {
  circles: Circle[];
  selectedCircle: string;
  onCircleChange: (circleId: string) => void;
  onSignOut: () => void;
  showNav?: boolean;
  overrideLabel?: string;
}

const navItems = [
  { to: "/profile", icon: User, label: "Profile" },
  { to: "/circles", icon: Users, label: "Circles" },
  { to: "/feed", icon: Home, label: "Feed" },
  { to: "/fridge", icon: Pin, label: "Fridge" },
  { to: "/events", icon: Calendar, label: "Events" },
  { to: "/albums", icon: Image, label: "Albums" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
];

export function CircleHeader({
  circles,
  selectedCircle,
  onCircleChange,
  onSignOut,
  showNav = true,
  overrideLabel,
}: CircleHeaderProps) {
  const currentCircle = circles.find((c) => c.id === selectedCircle);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={icon} alt="Familial" className="h-8 w-auto" />
            <span className="font-serif text-lg font-bold text-foreground">Familial</span>
          </Link>
          {overrideLabel ? (
            <>
              <span className="text-muted-foreground text-lg">/</span>
              <span className="font-medium text-foreground">{overrideLabel}</span>
            </>
          ) : circles.length > 0 && (
            <>
              <span className="text-muted-foreground text-lg">/</span>
              {circles.length === 1 ? (
                <span className="font-medium text-foreground">
                  {currentCircle?.name || "Circle"}
                </span>
              ) : (
                <Select value={selectedCircle} onValueChange={onCircleChange}>
                  <SelectTrigger className="w-fit min-w-[120px] h-8 border-none bg-transparent hover:bg-secondary/50 font-medium text-foreground gap-1">
                    <SelectValue placeholder="Select circle">
                      {currentCircle?.name || "Select circle"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {circles.map((circle) => (
                      <SelectItem key={circle.id} value={circle.id}>
                        {circle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
        {showNav && (
          <>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2 md:gap-4">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to}>
                  <Button variant="ghost" size="sm">
                    <item.icon className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">{item.label}</span>
                  </Button>
                </Link>
              ))}
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>

            {/* Mobile Navigation - Hamburger Menu */}
            {isMobile && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden min-h-[44px] min-w-[44px]">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <SheetHeader>
                    <SheetTitle className="text-left">Menu</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-2 mt-6">
                    {navItems.map((item) => (
                      <SheetClose asChild key={item.to}>
                        <Link to={item.to}>
                          <Button variant="ghost" className="w-full justify-start h-12">
                            <item.icon className="w-5 h-5 mr-3" />
                            {item.label}
                          </Button>
                        </Link>
                      </SheetClose>
                    ))}
                    <div className="border-t border-border my-2" />
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setSheetOpen(false);
                        onSignOut();
                      }}
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Sign Out
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            )}
          </>
        )}
      </div>
    </header>
  );
}
