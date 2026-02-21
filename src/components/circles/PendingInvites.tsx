import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCircleContext } from "@/contexts/CircleContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, X, Check, Loader2 } from "lucide-react";

interface PendingInvite {
  id: string;
  circle_id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
  circles: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface PendingInvitesProps {
  compact?: boolean;
}

const PendingInvites = ({ compact = false }: PendingInvitesProps) => {
  const { user } = useAuth();
  const { refetchCircles } = useCircleContext();
  const { toast } = useToast();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchInvites = async () => {
    if (!user?.email) return;

    const { data, error } = await supabase
      .from("circle_invites")
      .select("id, circle_id, email, status, created_at, expires_at, circles(id, name, description)")
      .eq("email", user.email)
      .eq("status", "pending");

    if (!error && data) {
      // Filter out expired invites client-side
      const valid = (data as unknown as PendingInvite[]).filter(
        (inv) => new Date(inv.expires_at) > new Date()
      );
      setInvites(valid);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInvites();
  }, [user]);

  const handleAccept = async (invite: PendingInvite) => {
    if (!user) return;
    setProcessingIds((prev) => new Set(prev).add(invite.id));

    // Insert membership
    const { error: joinError } = await supabase
      .from("circle_memberships")
      .insert({ circle_id: invite.circle_id, user_id: user.id, role: "member" });

    if (joinError) {
      toast({ title: "Error", description: "Failed to join circle.", variant: "destructive" });
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(invite.id); return s; });
      return;
    }

    // Mark invite as accepted
    await supabase
      .from("circle_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    toast({ title: "Joined!", description: `You've joined "${invite.circles.name}".` });
    await refetchCircles();
    setProcessingIds((prev) => { const s = new Set(prev); s.delete(invite.id); return s; });
  };

  const handleDecline = async (invite: PendingInvite) => {
    setProcessingIds((prev) => new Set(prev).add(invite.id));

    const { error } = await supabase
      .from("circle_invites")
      .update({ status: "declined" })
      .eq("id", invite.id);

    if (error) {
      toast({ title: "Error", description: "Failed to decline invite.", variant: "destructive" });
    } else {
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast({ title: "Invite declined" });
    }
    setProcessingIds((prev) => { const s = new Set(prev); s.delete(invite.id); return s; });
  };

  if (isLoading || invites.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3 mb-8"}>
      {!compact && (
        <h2 className="font-serif text-xl font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Pending Invitations
        </h2>
      )}
      {invites.map((invite) => {
        const isProcessing = processingIds.has(invite.id);
        return (
          <Card key={invite.id} className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {compact ? "Invite:" : "You've been invited to join"}{" "}
                    <span className="font-semibold">{invite.circles.name}</span>
                  </p>
                  {invite.circles.description && !compact && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {invite.circles.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(invite)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDecline(invite)}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PendingInvites;
