import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, TreeDeciduous, Trash2, Users } from "lucide-react";

interface Circle {
  id: string;
  name: string;
  owner_id: string;
}

interface FamilyMember {
  id: string;
  circle_id: string;
  name: string;
  birth_date: string | null;
  death_date: string | null;
  gender: string | null;
  photo_url: string | null;
  bio: string | null;
  parent1_id: string | null;
  parent2_id: string | null;
  spouse_id: string | null;
  linked_user_id: string | null;
}

const FamilyTree = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: contextLoading } = useCircleContext();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const circleIdParam = searchParams.get("circle");
  
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [newMember, setNewMember] = useState({
    name: "",
    birthDate: "",
    deathDate: "",
    gender: "",
    bio: "",
    parent1Id: "",
    parent2Id: "",
    spouseId: "",
  });

  useEffect(() => {
    if (circleIdParam && circles.length > 0) {
      setSelectedCircle(circleIdParam);
    }
  }, [circles, circleIdParam, setSelectedCircle]);

  useEffect(() => {
    if (selectedCircle) {
      fetchMembers();
      checkAdminStatus();
    } else if (!contextLoading) {
      setIsLoadingMembers(false);
    }
  }, [selectedCircle, contextLoading]);

  const checkAdminStatus = async () => {
    if (!user || !selectedCircle) return;
    
    const circle = circles.find(c => c.id === selectedCircle);
    if (circle?.owner_id === user.id) {
      setIsAdmin(true);
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("circle_id", selectedCircle)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const fetchMembers = async () => {
    if (!selectedCircle) return;
    
    setIsLoadingMembers(true);
    const { data, error } = await supabase
      .from("family_tree_members")
      .select("*")
      .eq("circle_id", selectedCircle)
      .order("name");

    if (!error && data) {
      setMembers(data);
    }
    setIsLoadingMembers(false);
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim() || !user || !selectedCircle) return;

    const { error } = await supabase
      .from("family_tree_members")
      .insert({
        circle_id: selectedCircle,
        name: newMember.name.trim(),
        birth_date: newMember.birthDate || null,
        death_date: newMember.deathDate || null,
        gender: newMember.gender || null,
        bio: newMember.bio.trim() || null,
        parent1_id: newMember.parent1Id || null,
        parent2_id: newMember.parent2Id || null,
        spouse_id: newMember.spouseId || null,
        created_by: user.id,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add family member. Please try again.",
        variant: "destructive",
      });
    } else {
      setNewMember({
        name: "",
        birthDate: "",
        deathDate: "",
        gender: "",
        bio: "",
        parent1Id: "",
        parent2Id: "",
        spouseId: "",
      });
      setIsAddOpen(false);
      fetchMembers();
      toast({
        title: "Member added!",
        description: `${newMember.name} has been added to the family tree.`,
      });
    }
  };

  const handleDeleteMember = async (member: FamilyMember) => {
    if (!confirm(`Are you sure you want to remove ${member.name} from the family tree?`)) {
      return;
    }

    const { error } = await supabase
      .from("family_tree_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove family member.",
        variant: "destructive",
      });
    } else {
      fetchMembers();
      toast({
        title: "Member removed",
        description: `${member.name} has been removed from the family tree.`,
      });
    }
  };

  if (contextLoading || isLoadingMembers) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-9 w-40 mb-2" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  if (circles.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
              Create a Circle First
            </h3>
            <p className="text-muted-foreground mb-6">
              You need to create or join a circle before building a family tree.
            </p>
            <Link to="/circles">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create a Circle
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
            <TreeDeciduous className="w-8 h-8" />
            Family Tree
          </h1>
          <p className="text-muted-foreground mt-1">
            Map out your family connections
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif">Add Family Member</DialogTitle>
                <DialogDescription>
                  Add someone to your family tree.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Full name"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Birth Date</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={newMember.birthDate}
                      onChange={(e) => setNewMember({ ...newMember, birthDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deathDate">Death Date</Label>
                    <Input
                      id="deathDate"
                      type="date"
                      value={newMember.deathDate}
                      onChange={(e) => setNewMember({ ...newMember, deathDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={newMember.gender}
                    onValueChange={(value) => setNewMember({ ...newMember, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="A brief description..."
                    value={newMember.bio}
                    onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
                    maxLength={1000}
                  />
                </div>
                {members.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label>Parent 1</Label>
                      <Select
                        value={newMember.parent1Id}
                        onValueChange={(value) => setNewMember({ ...newMember, parent1Id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Parent 2</Label>
                      <Select
                        value={newMember.parent2Id}
                        onValueChange={(value) => setNewMember({ ...newMember, parent2Id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Spouse</Label>
                      <Select
                        value={newMember.spouseId}
                        onValueChange={(value) => setNewMember({ ...newMember, spouseId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select spouse" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <Button 
                  className="w-full" 
                  onClick={handleAddMember}
                  disabled={!newMember.name.trim()}
                >
                  Add Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TreeDeciduous className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
              No family members yet
            </h3>
            <p className="text-muted-foreground mb-6">
              {isAdmin 
                ? "Start building your family tree by adding members."
                : "Ask a circle admin to add family members."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Card key={member.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.photo_url || undefined} />
                    <AvatarFallback className="bg-secondary text-foreground font-serif">
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="font-serif text-lg">{member.name}</CardTitle>
                    {member.birth_date && (
                      <CardDescription>
                        {new Date(member.birth_date).getFullYear()}
                        {member.death_date && ` - ${new Date(member.death_date).getFullYear()}`}
                      </CardDescription>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteMember(member)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {member.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {member.bio}
                  </p>
                )}
                {member.gender && (
                  <p className="text-xs text-muted-foreground mt-2 capitalize">
                    {member.gender}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default FamilyTree;
