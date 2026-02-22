import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, Trash2, Heart, MessageCircle, Calendar, UserPlus, Users, Loader2 } from "lucide-react";
import PendingInvites from "@/components/circles/PendingInvites";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const Notifications = () => {
  const { user } = useAuth();
  const { isLoading: contextLoading, selectedCircle } = useCircleContext();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 50;

  useEffect(() => {
    if (user && selectedCircle) {
      fetchNotifications();
    }
  }, [user, selectedCircle]);

  const fetchNotifications = async (reset = true) => {
    if (!user) return;
    
    if (reset) setIsLoadingNotifications(true);
    const cursor = !reset && notifications.length > 0 ? notifications[notifications.length - 1].created_at : null;

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("related_circle_id", selectedCircle)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (!error && data) {
      setNotifications(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setIsLoadingNotifications(false);
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: false } : n)
      );
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark notifications as read.",
        variant: "destructive",
      });
      return;
    }

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast({
      title: "All notifications marked as read",
    });
  };

  const deleteNotification = async (id: string) => {
    const prev = notifications;
    setNotifications(p => p.filter(n => n.id !== id));

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      setNotifications(prev);
      toast({
        title: "Error",
        description: "Failed to delete notification.",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "reaction":
        return <Heart className="w-4 h-4" />;
      case "comment":
      case "comment_reply":
        return <MessageCircle className="w-4 h-4" />;
      case "invite":
      case "circle_invite":
        return <UserPlus className="w-4 h-4" />;
      case "event":
        return <Calendar className="w-4 h-4" />;
      case "circle":
        return <Users className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  if (contextLoading || isLoadingNotifications) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-9 w-40 mb-2" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="mb-3">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-64 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
            <Bell className="w-8 h-8" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <Check className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <PendingInvites compact />

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              No notifications yet
            </h2>
            <p className="text-muted-foreground">
              You'll see updates from your circles here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`transition-colors ${!notification.is_read ? 'bg-secondary/30' : ''}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${!notification.is_read ? 'bg-foreground text-background' : 'bg-secondary text-foreground'}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {notification.link ? (
                      <Link to={notification.link} className="hover:underline">
                        <p className={`text-foreground ${!notification.is_read ? 'font-medium' : ''}`}>
                          {notification.title}
                        </p>
                      </Link>
                    ) : (
                      <p className={`text-foreground ${!notification.is_read ? 'font-medium' : ''}`}>
                        {notification.title}
                      </p>
                    )}
                    {notification.message && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(notification.created_at).toLocaleDateString()} at{' '}
                      {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        aria-label="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                      aria-label="Delete notification"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasMore && notifications.length > 0 && (
        <div className="text-center py-4">
          <Button variant="outline" onClick={() => fetchNotifications(false)}>
            <Loader2 className="w-4 h-4 mr-2" />
            Load More
          </Button>
        </div>
      )}
    </main>
  );
};

export default Notifications;
