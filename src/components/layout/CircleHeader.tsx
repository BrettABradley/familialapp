import { useState, useEffect } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LogOut, Users, Calendar, Settings, Pin, MessageSquare, Image, Menu, Home, User, Bell, Check, Trash2 } from "lucide-react";
import icon from "@/assets/icon.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  const { user } = useAuth();
  const currentCircle = circles.find((c) => c.id === selectedCircle);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Notification bell state
  interface NotifItem { id: string; title: string; message: string | null; is_read: boolean; created_at: string; type: string; }
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel('header-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at, type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const notifBell = (
    <Popover open={bellOpen} onOpenChange={setBellOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-serif font-semibold text-sm">Notifications</span>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                <Check className="w-3 h-3 mr-1" />Mark read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleClearAll}>
                <Trash2 className="w-3 h-3 mr-1" />Clear all
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 ${!n.is_read ? "bg-secondary/30" : ""}`}>
                <p className={`text-sm ${!n.is_read ? "font-medium" : ""} text-foreground`}>{n.title}</p>
                {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <Link to="/notifications" onClick={() => setBellOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full text-xs">View all notifications</Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

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
              {notifBell}
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>

            {/* Mobile Navigation - Hamburger Menu */}
            {isMobile && (
              <div className="flex items-center gap-1 md:hidden">
                {notifBell}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]">
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
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
