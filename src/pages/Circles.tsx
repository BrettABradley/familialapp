import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Users, ArrowLeft, Trash2, UserPlus, Crown, Edit, Copy, Check, KeyRound, ArrowRightLeft, LogOut, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PendingInvites from "@/components/circles/PendingInvites";
import UpgradePlanDialog from "@/components/circles/UpgradePlanDialog";
import { checkCircleCapacity, getCircleMemberCount, getCircleMemberLimit } from "@/lib/circleLimits";

interface Circle {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  invite_code: string;
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
  const { user } = useAuth();
  const { circles, isLoading: contextLoading, refetchCircles, profile, setSelectedCircle: setContextCircle } = useCircleContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);

  const [memberships, setMemberships] = useState<CircleMembership[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [newCircleName, setNewCircleName] = useState("");
  const [newCircleDescription, setNewCircleDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<{ plan: string; currentCount: number; limit: number; circleId: string }>({ plan: "free", currentCount: 0, limit: 8, circleId: "" });
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isLeaveTransferOpen, setIsLeaveTransferOpen] = useState(false);
  const [circleCount, setCircleCount] = useState(0);
  const [circleLimit, setCircleLimit] = useState(3);
  const [memberInfo, setMemberInfo] = useState<Record<string, { count: number; limit: number; plan: string }>>({});
  const [requestingUpgrade, setRequestingUpgrade] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.rpc("get_circle_count").then(({ data }) => setCircleCount(data ?? 0));
      supabase.rpc("get_circle_limit").then(({ data }) => setCircleLimit(data ?? 3));
    }
  }, [user, circles]);

  // Type guard for circles with full properties
  const circlesList = circles as unknown as Circle[];

  // Fetch member counts and limits for all circles
  const fetchMemberInfo = useCallback(async () => {
    if (circlesList.length === 0) return;
    const results: Record<string, { count: number; limit: number; plan: string }> = {};
    await Promise.all(
      circlesList.map(async (circle) => {
        const [count, limitInfo] = await Promise.all([
          getCircleMemberCount(circle.id),
          getCircleMemberLimit(circle.owner_id, circle.id),
        ]);
        results[circle.id] = { count, limit: limitInfo.limit, plan: limitInfo.plan };
      })
    );
    setMemberInfo(results);
  }, [circlesList.length, circlesList.map(c => c.id).join(",")]);

  useEffect(() => {
    fetchMemberInfo();
  }, [fetchMemberInfo]);

  // Re-fetch after checkout success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast({ title: "Payment successful!", description: "Your plan has been updated." });
      // Clean up URL
      window.history.replaceState({}, "", "/circles");
      // Re-fetch data after a short delay to allow webhook processing
      setTimeout(() => {
        refetchCircles();
        fetchMemberInfo();
      }, 2000);
    }
  }, []);

  const handleRequestUpgrade = async (circle: Circle) => {
    if (!user || !profile) return;
    setRequestingUpgrade(circle.id);

    try {
      // Rate limit: check if already requested in last 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", circle.owner_id)
        .eq("type", "upgrade_request")
        .eq("related_circle_id", circle.id)
        .eq("related_user_id", user.id)
        .gte("created_at", oneDayAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        toast({ title: "Already requested", description: "You've already sent an upgrade request for this circle recently." });
        setRequestingUpgrade(null);
        return;
      }

      const info = memberInfo[circle.id];
      const { error } = await supabase.from("notifications").insert({
        user_id: circle.owner_id,
        type: "upgrade_request",
        title: "Upgrade Request",
        message: `${profile.display_name || "A member"} is requesting you upgrade ${circle.name} (${info?.count ?? "?"}/${info?.limit ?? "?"} members)`,
        related_circle_id: circle.id,
        related_user_id: user.id,
        link: "/circles",
      });

      if (error) throw error;
      toast({ title: "Request sent!", description: "The circle owner has been notified." });
    } catch {
      toast({ title: "Error", description: "Failed to send upgrade request.", variant: "destructive" });
    }
    setRequestingUpgrade(null);
  };

  const getMemberBadgeVariant = (circleId: string): "default" | "secondary" | "destructive" => {
    const info = memberInfo[circleId];
    if (!info) return "secondary";
    const ratio = info.count / info.limit;
    if (ratio >= 1) return "destructive";
    if (ratio >= 0.8) return "default";
    return "secondary";
  };

  const fetchMemberships = async (circleId: string) => {
    const { data } = await supabase
      .from("circle_memberships")
      .select(`*, profiles!circle_memberships_user_id_profiles_fkey(display_name, avatar_url)`)
      .eq("circle_id", circleId);

    if (data) {
      setMemberships(data as unknown as CircleMembership[]);
    }
  };

  const handleCreateCircle = async () => {
    if (!newCircleName.trim() || !user) return;

    setIsCreating(true);

    const { data, error } = await supabase
      .from("circles")
      .insert({
        name: newCircleName.trim(),
        description: newCircleDescription.trim() ? newCircleDescription.trim() : null,
        owner_id: user.id,
      })
      .select("id, name, description, owner_id, created_at")
      .maybeSingle();

    if (error) {
      const isLimitError = error.message?.includes("can_create_circle") || error.code === "42501";
      if (isLimitError) {
        toast({
          title: "Plan Limit Reached",
          description: (
            <span>
              You've reached your circle creation limit.{" "}
              <a href="/#pricing" className="underline font-medium text-primary hover:text-primary/80">
                Upgrade your plan
              </a>{" "}
              to create more circles.
            </span>
          ),
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: "Failed to create circle. Please try again.", variant: "destructive" });
      }
      setIsCreating(false);
      return;
    }

    if (data?.id) {
      await supabase.from("circle_memberships").insert({ circle_id: data.id, user_id: user.id, role: "admin" });
    }

    toast({ title: "Circle created!", description: `${newCircleName} is ready.` });
    setNewCircleName("");
    setNewCircleDescription("");
    setIsCreateOpen(false);
    await refetchCircles();
    setIsCreating(false);
  };

  const handleUpdateCircle = async () => {
    if (!editName.trim() || !selectedCircle) return;

    setIsUpdating(true);

    const { error } = await supabase
      .from("circles")
      .update({ name: editName.trim(), description: editDescription.trim() || null })
      .eq("id", selectedCircle.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update circle.", variant: "destructive" });
    } else {
      toast({ title: "Updated!", description: "Circle information saved." });
      setIsEditOpen(false);
      refetchCircles();
    }

    setIsUpdating(false);
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !selectedCircle || !user) return;
    
    setIsSendingInvite(true);

    // Check member limit before inviting
    const capacity = await checkCircleCapacity(selectedCircle.id, selectedCircle.owner_id);
    if (capacity.isFull) {
      setUpgradeInfo({ plan: capacity.plan, currentCount: capacity.currentCount, limit: capacity.limit, circleId: selectedCircle.id });
      setUpgradeDialogOpen(true);
      setIsSendingInvite(false);
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-circle-invite", {
        body: {
          email: inviteEmail,
          circleName: selectedCircle.name,
          inviterName: profile?.display_name || "A family member",
          circleId: selectedCircle.id,
        },
      });

      if (fnError) {
        console.error("Circle invite error:", fnError);
        toast({ title: "Error", description: "Failed to send invite. Please try again.", variant: "destructive" });
      } else if (data?.error) {
        console.error("Circle invite error from response:", data.error);
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Invite sent!", description: `Invitation email sent to ${inviteEmail}.` });
      }
    } catch (err) {
      console.error("Circle invite exception:", err);
      toast({ title: "Error", description: "Failed to send invite. Please try again.", variant: "destructive" });
    }

    setInviteEmail("");
    setIsInviteOpen(false);
    setIsSendingInvite(false);
  };

  const handleUpdateRole = async (membership: CircleMembership, newRole: string) => {
    const { error } = await supabase
      .from("circle_memberships")
      .update({ role: newRole })
      .eq("id", membership.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    } else {
      toast({ title: "Role updated!" });
      fetchMemberships(membership.circle_id);
    }
  };

  const handleRemoveMember = async (membership: CircleMembership) => {
    if (!confirm("Remove this member from the circle?")) return;

    const { error } = await supabase.from("circle_memberships").delete().eq("id", membership.id);

    if (error) {
      toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
    } else {
      toast({ title: "Member removed" });
      fetchMemberships(membership.circle_id);
    }
  };

  const handleDeleteCircle = async (circle: Circle) => {
    if (!confirm(`Delete "${circle.name}"? This cannot be undone.`)) return;
    
    const { error } = await supabase.from("circles").delete().eq("id", circle.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete circle.", variant: "destructive" });
    } else {
      refetchCircles();
      toast({ title: "Circle deleted" });
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim() || !user) return;
    setIsJoining(true);

    const { data: circle, error: lookupError } = await supabase
      .from("circles")
      .select("id, name")
      .eq("invite_code", joinCode.trim())
      .maybeSingle();

    if (lookupError || !circle) {
      toast({ title: "Invalid code", description: "No circle found with that invite code.", variant: "destructive" });
      setIsJoining(false);
      return;
    }

    // Check if already a member or owner
    const alreadyIn = circlesList.some((c) => c.id === circle.id);
    if (alreadyIn) {
      toast({ title: "Already a member", description: `You're already in "${circle.name}".` });
      setIsJoining(false);
      setJoinCode("");
      setIsJoinOpen(false);
      return;
    }

    // Check member limit before joining
    const { data: circleDetail } = await supabase
      .from("circles")
      .select("owner_id")
      .eq("id", circle.id)
      .maybeSingle();

    if (circleDetail) {
      const capacity = await checkCircleCapacity(circle.id, circleDetail.owner_id);
      if (capacity.isFull) {
        setUpgradeInfo({ plan: capacity.plan, currentCount: capacity.currentCount, limit: capacity.limit, circleId: circle.id });
        setUpgradeDialogOpen(true);
        setIsJoining(false);
        setIsJoinOpen(false);
        return;
      }
    }

    const { error: joinError } = await supabase
      .from("circle_memberships")
      .insert({ circle_id: circle.id, user_id: user.id, role: "member" });

    if (joinError) {
      const msg = joinError.message?.includes("member limit")
        ? "This circle has reached its member limit."
        : joinError.message || "Could not join circle.";
      toast({ title: "Join failed", description: msg, variant: "destructive" });
    } else {
      toast({ title: "Joined!", description: `You're now a member of "${circle.name}".` });
      await refetchCircles();
      setJoinCode("");
      setIsJoinOpen(false);
    }
    setIsJoining(false);
  };

  const handleLeaveCircle = async (circle: Circle) => {
    if (!user) return;

    if (isOwner(circle)) {
      // Owner needs to transfer ownership first
      setSelectedCircle(circle);
      await fetchMemberships(circle.id);
      setIsLeaveTransferOpen(true);
      return;
    }

    if (!confirm(`Leave "${circle.name}"? You'll need a new invite to rejoin.`)) return;

    const { error } = await supabase
      .from("circle_memberships")
      .delete()
      .eq("circle_id", circle.id)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to leave circle.", variant: "destructive" });
    } else {
      toast({ title: "Left circle", description: `You've left "${circle.name}".` });
      await refetchCircles();
    }
  };

  const handleTransferAndLeave = async (newOwnerId: string) => {
    if (!selectedCircle || !user) return;
    if (!confirm("Transfer ownership and leave this circle? This cannot be undone.")) return;
    setIsTransferring(true);

    const { error: transferError } = await supabase.rpc("transfer_circle_ownership", {
      _circle_id: selectedCircle.id,
      _new_owner_id: newOwnerId,
    });

    if (transferError) {
      toast({ title: "Error", description: transferError.message || "Failed to transfer ownership.", variant: "destructive" });
      setIsTransferring(false);
      return;
    }

    // Now leave (transfer made us a member with admin role)
    const { error: leaveError } = await supabase
      .from("circle_memberships")
      .delete()
      .eq("circle_id", selectedCircle.id)
      .eq("user_id", user.id);

    if (leaveError) {
      toast({ title: "Ownership transferred", description: "Ownership transferred but could not leave. You are now an admin member.", variant: "default" });
    } else {
      toast({ title: "Left circle", description: `Ownership transferred and you've left "${selectedCircle.name}".` });
    }

    setIsLeaveTransferOpen(false);
    setIsTransferring(false);
    await refetchCircles();
  };

  const isOwner = (circle: Circle) => circle.owner_id === user?.id;

  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!selectedCircle) return;
    if (!confirm("Are you sure you want to transfer ownership? You will become an admin member.")) return;
    setIsTransferring(true);
    const { error } = await supabase.rpc("transfer_circle_ownership", {
      _circle_id: selectedCircle.id,
      _new_owner_id: newOwnerId,
    });
    if (error) {
      toast({ title: "Error", description: error.message || "Failed to transfer ownership.", variant: "destructive" });
    } else {
      toast({ title: "Ownership transferred!", description: "You are now an admin member of this circle." });
      setIsTransferOpen(false);
      setIsMembersOpen(false);
      await refetchCircles();
    }
    setIsTransferring(false);
  };

  if (contextLoading) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-9 w-40 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Your Circles</h1>
          <p className="text-muted-foreground mt-1">Private spaces for your family and close friends · {circleCount}/{circleLimit} circles created</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
            <DialogTrigger asChild><Button variant="outline"><KeyRound className="w-4 h-4 mr-2" />Join with Code</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Join a Circle</DialogTitle>
                <DialogDescription>Enter the invite code shared by your family or friends.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="joinCode">Invite Code</Label>
                  <Input id="joinCode" placeholder="e.g., a1b2c3d4" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} maxLength={8} />
                </div>
                <Button className="w-full" onClick={handleJoinByCode} disabled={!joinCode.trim() || isJoining}>{isJoining ? "Joining..." : "Join Circle"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Create Circle</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Create a New Circle</DialogTitle>
                <DialogDescription>A circle is a private space for your family or close friends.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Circle Name</Label>
                  <Input id="name" placeholder="e.g., Smith Family" value={newCircleName} onChange={(e) => setNewCircleName(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea id="description" placeholder="What's this circle about?" value={newCircleDescription} onChange={(e) => setNewCircleDescription(e.target.value)} maxLength={500} />
                </div>
                <Button className="w-full" onClick={handleCreateCircle} disabled={!newCircleName.trim() || isCreating}>{isCreating ? "Creating..." : "Create Circle"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {pendingCount > 0 && (
        <h2 className="font-serif text-xl font-semibold text-foreground flex items-center gap-2 mb-2">
          <UserPlus className="w-5 h-5" />
          Pending Invitations
          <Badge variant="secondary">{pendingCount}</Badge>
        </h2>
      )}
      <PendingInvites onCountChange={setPendingCount} />

      {circlesList.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h2 className="font-serif text-xl font-semibold text-foreground mb-2">No circles yet</h2><p className="text-muted-foreground mb-6">Create your first circle to start sharing with your family.</p><Button onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Your First Circle</Button></CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {circlesList.map((circle) => (
            <Card key={circle.id} className="relative group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12"><AvatarFallback className="bg-secondary text-foreground font-serif text-lg">{circle.name.charAt(0)}</AvatarFallback></Avatar>
                    <div>
                      <CardTitle className="font-serif text-lg flex items-center gap-2"><button type="button" className="hover:underline cursor-pointer text-left" onClick={() => { setContextCircle(circle.id); navigate("/feed"); }}>{circle.name}</button>{isOwner(circle) && <Crown className="w-4 h-4 text-muted-foreground" />}</CardTitle>
                      <CardDescription>Created {new Date(circle.created_at).toLocaleDateString()}</CardDescription>
                    </div>
                  </div>
                  {isOwner(circle) && (
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => handleDeleteCircle(circle)} aria-label={`Delete circle ${circle.name}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {circle.description && <p className="text-muted-foreground text-sm mb-3">{circle.description}</p>}

                {/* Member counter */}
                {memberInfo[circle.id] && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={getMemberBadgeVariant(circle.id)} className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {memberInfo[circle.id].count}/{memberInfo[circle.id].limit} members
                      </Badge>
                      {isOwner(circle) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          title="Upgrade or add members"
                          onClick={() => {
                            const info = memberInfo[circle.id];
                            setUpgradeInfo({ plan: info.plan, currentCount: info.count, limit: info.limit, circleId: circle.id });
                            setUpgradeDialogOpen(true);
                          }}
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}
                    </div>
                    {!isOwner(circle) && memberInfo[circle.id].count >= memberInfo[circle.id].limit * 0.8 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleRequestUpgrade(circle)}
                        disabled={requestingUpgrade === circle.id}
                      >
                        <ArrowUp className="w-3 h-3 mr-1" />{requestingUpgrade === circle.id ? "Sending..." : "Request Upgrade"}
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-secondary/50 border border-border">
                  <span className="text-xs text-muted-foreground">Invite Code:</span>
                  <code className="text-sm font-mono font-semibold text-foreground">{circle.invite_code}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-auto"
                    onClick={() => {
                      navigator.clipboard.writeText(circle.invite_code);
                      setCopiedId(circle.id);
                      setTimeout(() => setCopiedId(null), 2000);
                      toast({ title: "Copied!", description: "Invite code copied to clipboard." });
                    }}
                  >
                    {copiedId === circle.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedCircle(circle); setIsInviteOpen(true); }}><UserPlus className="w-4 h-4 mr-2" />Invite</Button>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedCircle(circle); fetchMemberships(circle.id); setIsMembersOpen(true); }}><Users className="w-4 h-4 mr-2" />Members</Button>
                  {isOwner(circle) && (
                    <Button variant="outline" size="sm" onClick={() => { setSelectedCircle(circle); setEditName(circle.name); setEditDescription(circle.description || ""); setIsEditOpen(true); }}><Edit className="w-4 h-4 mr-2" />Edit</Button>
                  )}
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleLeaveCircle(circle)}>
                    <LogOut className="w-4 h-4 mr-2" />Leave
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Invite to {selectedCircle?.name}</DialogTitle><DialogDescription>Send an invitation to join this circle.</DialogDescription></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" type="email" placeholder="family@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></div>
            <Button className="w-full" onClick={handleInviteMember} disabled={!inviteEmail.trim() || isSendingInvite}>{isSendingInvite ? "Sending..." : "Send Invitation"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Edit {selectedCircle?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={500} /></div>
            <Button className="w-full" onClick={handleUpdateCircle} disabled={!editName.trim() || isUpdating}>{isUpdating ? "Saving..." : "Save Changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-serif">{selectedCircle?.name} Members</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
            {memberships.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No members yet</p>
            ) : (
              memberships.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <Avatar className="h-10 w-10"><AvatarFallback>{member.profiles?.display_name?.charAt(0) || "U"}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{member.profiles?.display_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                   {selectedCircle && isOwner(selectedCircle) && member.user_id !== user?.id && (
                    <div className="flex items-center gap-2">
                      <Select value={member.role} onValueChange={(val) => handleUpdateRole(member, val)}>
                        <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="moderator">Mod</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member)} aria-label={`Remove ${member.profiles?.display_name || 'member'}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {selectedCircle && isOwner(selectedCircle) && memberships.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <Button variant="outline" className="w-full" onClick={() => setIsTransferOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />Transfer Ownership
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Transfer Ownership of {selectedCircle?.name}</DialogTitle>
            <DialogDescription>Select a member to become the new owner. You will become an admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
            {memberships.filter(m => m.user_id !== user?.id).map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <Avatar className="h-10 w-10"><AvatarFallback>{member.profiles?.display_name?.charAt(0) || "U"}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{member.profiles?.display_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleTransferOwnership(member.user_id)} disabled={isTransferring}>
                  <Crown className="w-4 h-4 mr-1" />Transfer
                </Button>
              </div>
            ))}
            {memberships.filter(m => m.user_id !== user?.id).length === 0 && (
              <p className="text-muted-foreground text-center py-4">No other members to transfer to</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer & Leave Dialog (for owners leaving) */}
      <Dialog open={isLeaveTransferOpen} onOpenChange={setIsLeaveTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Transfer Ownership to Leave</DialogTitle>
            <DialogDescription>
              As the owner of "{selectedCircle?.name}", you must transfer ownership to another member before leaving. Select the new owner below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
            {memberships.filter(m => m.user_id !== user?.id).map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <Avatar className="h-10 w-10"><AvatarFallback>{member.profiles?.display_name?.charAt(0) || "U"}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{member.profiles?.display_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleTransferAndLeave(member.user_id)} disabled={isTransferring}>
                  <Crown className="w-4 h-4 mr-1" />Transfer & Leave
                </Button>
              </div>
            ))}
            {memberships.filter(m => m.user_id !== user?.id).length === 0 && (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-2">No other members to transfer ownership to.</p>
                <p className="text-sm text-muted-foreground">You can delete the circle instead, or invite someone first.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Plan Dialog */}
      <UpgradePlanDialog
        isOpen={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        currentPlan={upgradeInfo.plan}
        currentCount={upgradeInfo.currentCount}
        limit={upgradeInfo.limit}
        circleId={upgradeInfo.circleId}
      />
    </main>
  );
};

export default Circles;
