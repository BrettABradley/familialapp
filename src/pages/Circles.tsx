// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, LogOut, ArrowLeft, Trash2, UserPlus, Crown } from "lucide-react";
import icon from "@/assets/icon.png";

interface Circle {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface CircleMembership {
  id: string;
  circle_id: string;
  user_id: string;
  role: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const Circles = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const db: any = supabase;
  const [circles, setCircles] = useState<Circle[]>([]);
  const [memberships, setMemberships] = useState<CircleMembership[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [newCircleName, setNewCircleName] = useState("");
  const [newCircleDescription, setNewCircleDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCircles();
    }
  }, [user]);

  const fetchCircles = async () => {
    if (!user) return;

    // Get circles where user is owner
    const { data: ownedCircles } = await db.from("circles").select("*").eq("owner_id", user.id);

    // Get circles where user is member
    const { data: memberCircles } = await db
      .from("circle_memberships")
      .select("circle_id, circles(*)")
      .eq("user_id", user.id);

    const allCircles: Circle[] = [];
    
    if (ownedCircles) {
      allCircles.push(...ownedCircles);
    }
    
    if (memberCircles) {
      memberCircles.forEach((m) => {
        if (m.circles && !allCircles.find(c => c.id === (m.circles as Circle).id)) {
          allCircles.push(m.circles as Circle);
        }
      });
    }
    
    setCircles(allCircles);
  };

  const fetchMemberships = async (circleId: string) => {
    const { data } = await db
      .from("circle_memberships")
      .select(
        `
        *,
        profiles!circle_memberships_user_id_fkey(display_name, avatar_url)
      `
      )
      .eq("circle_id", circleId);

    if (data) {
      setMemberships(data as unknown as CircleMembership[]);
    }
  };

  const handleCreateCircle = async () => {
    if (!newCircleName.trim() || !user) return;

    setIsCreating(true);

    const { data, error } = await db
      .from("circles")
      .insert({
        name: newCircleName.trim(),
        description: newCircleDescription.trim() ? newCircleDescription.trim() : null,
        owner_id: user.id,
      })
      .select("id, name, description, owner_id, created_at")
      .maybeSingle();

    if (error) {
      console.error("Create circle failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create circle. Please try again.",
        variant: "destructive",
      });
      setIsCreating(false);
      return;
    }

    // Sometimes the insert succeeds but RLS prevents returning the row; fall back to refetch.
    if (!data?.id) {
      await fetchCircles();
      toast({
        title: "Circle created",
        description: "Your circle was created. Refreshing your list…",
      });
      setNewCircleName("");
      setNewCircleDescription("");
      setIsCreateOpen(false);
      setIsCreating(false);
      return;
    }

    const { error: membershipError } = await supabase.from("circle_memberships").insert({
      circle_id: data.id,
      user_id: user.id,
      role: "admin",
    });

    if (membershipError) {
      console.error("Add owner membership failed:", membershipError);
      toast({
        title: "Circle created",
        description: "Created the circle, but failed to add you as a member. Please refresh and try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Circle created!",
        description: `${data.name} is ready for your family.`,
      });
    }

    setNewCircleName("");
    setNewCircleDescription("");
    setIsCreateOpen(false);
    await fetchCircles();

    setIsCreating(false);
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !selectedCircle) return;
    
    const { error } = await db.from("circle_invites").insert({
      circle_id: selectedCircle.id,
      invited_by: user!.id,
      email: inviteEmail,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send invite. Please try again.",
        variant: "destructive",
      });
    } else {
      setInviteEmail("");
      setIsInviteOpen(false);
      toast({
        title: "Invite sent!",
        description: `An invitation has been sent to ${inviteEmail}.`,
      });
    }
  };

  const handleDeleteCircle = async (circle: Circle) => {
    if (!confirm(`Are you sure you want to delete "${circle.name}"? This cannot be undone.`)) {
      return;
    }
    
    const { error } = await db.from("circles").delete().eq("id", circle.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete circle.",
        variant: "destructive",
      });
    } else {
      fetchCircles();
      toast({
        title: "Circle deleted",
        description: `${circle.name} has been removed.`,
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={icon} alt="Familial" className="h-8 w-auto" />
            <span className="font-serif text-lg font-bold text-foreground">Familial</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Feed
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Your Circles</h1>
            <p className="text-muted-foreground mt-1">
              Private spaces for your family and close friends
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Circle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Create a New Circle</DialogTitle>
                <DialogDescription>
                  A circle is a private space for your family or close friends.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Circle Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Smith Family"
                    value={newCircleName}
                    onChange={(e) => setNewCircleName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="What's this circle about?"
                    value={newCircleDescription}
                    onChange={(e) => setNewCircleDescription(e.target.value)}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateCircle}
                  disabled={!newCircleName.trim() || isCreating}
                >
                  {isCreating ? "Creating..." : "Create Circle"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {circles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                No circles yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Create your first circle to start sharing with your family.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Circle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {circles.map((circle) => (
              <Card key={circle.id} className="relative group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-secondary text-foreground font-serif text-lg">
                          {circle.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="font-serif text-lg flex items-center gap-2">
                          {circle.name}
                          {circle.owner_id === user?.id && (
                            <Crown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </CardTitle>
                        <CardDescription>
                          Created {new Date(circle.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    {circle.owner_id === user?.id && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteCircle(circle)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {circle.description && (
                    <p className="text-muted-foreground text-sm mb-4">{circle.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Dialog open={isInviteOpen && selectedCircle?.id === circle.id} onOpenChange={(open) => {
                      setIsInviteOpen(open);
                      if (open) {
                        setSelectedCircle(circle);
                        fetchMemberships(circle.id);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="font-serif">Invite to {circle.name}</DialogTitle>
                          <DialogDescription>
                            Send an invitation to join this circle.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="family@example.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                          </div>
                          <Button 
                            className="w-full" 
                            onClick={handleInviteMember}
                            disabled={!inviteEmail.trim()}
                          >
                            Send Invitation
                          </Button>
                        </div>
                        {memberships.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-border">
                            <h4 className="font-medium text-foreground mb-3">Members</h4>
                            <div className="space-y-2">
                              {memberships.map((member) => (
                                <div key={member.id} className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs">
                                      {member.profiles?.display_name?.charAt(0) || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="text-sm text-foreground">
                                      {member.profiles?.display_name || "Unknown"}
                                    </p>
                                  </div>
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {member.role}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Circles;
