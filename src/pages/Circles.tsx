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
import { Plus, Users, ArrowLeft, Trash2, UserPlus, Crown, Edit, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PendingInvites from "@/components/circles/PendingInvites";

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
  const { circles, isLoading: contextLoading, refetchCircles, profile } = useCircleContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);

  const [memberships, setMemberships] = useState<CircleMembership[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [newCircleName, setNewCircleName] = useState("");
  const [newCircleDescription, setNewCircleDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Type guard for circles with full properties
  const circlesList = circles as unknown as Circle[];

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
      const message = error.message?.includes("can_create_circle")
        ? "You've reached your circle limit. Upgrade your plan to create more circles."
        : error.message || "Failed to create circle.";
      toast({ title: "Error", description: message, variant: "destructive" });
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

    const { error } = await supabase.from("circle_invites").insert({
      circle_id: selectedCircle.id,
      invited_by: user.id,
      email: inviteEmail,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create invite.", variant: "destructive" });
      setIsSendingInvite(false);
      return;
    }

    try {
      const { error: emailError } = await supabase.functions.invoke("send-circle-invite", {
        body: {
          email: inviteEmail,
          circleName: selectedCircle.name,
          inviterName: profile?.display_name || "A family member",
          circleId: selectedCircle.id,
        },
      });

      if (emailError) {
        console.error("Circle invite email error:", emailError);
        toast({ title: "Invite created", description: `Invitation saved, but email failed to send.`, variant: "default" });
      } else {
        toast({ title: "Invite sent!", description: `Invitation email sent to ${inviteEmail}.` });
      }
    } catch (err) {
      // Email send failed
      toast({ title: "Invite created", description: `Invitation saved, but email failed to send.` });
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

  const isOwner = (circle: Circle) => circle.owner_id === user?.id;

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
          <p className="text-muted-foreground mt-1">Private spaces for your family and close friends</p>
        </div>
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
                      <CardTitle className="font-serif text-lg flex items-center gap-2">{circle.name}{isOwner(circle) && <Crown className="w-4 h-4 text-muted-foreground" />}</CardTitle>
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
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Circles;
