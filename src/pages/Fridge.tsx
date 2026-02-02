// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CircleHeader } from "@/components/layout/CircleHeader";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { FridgeBoard, type FridgeBoardPin } from "@/components/fridge/FridgeBoard";
import { Plus, Pin, Image, FileText, Calendar } from "lucide-react";


interface Circle {
  id: string;
  name: string;
  owner_id: string;
}

interface FridgePin {
  id: string;
  circle_id: string;
  pinned_by: string;
  title: string;
  content: string | null;
  image_url: string | null;
  pin_type: string;
  created_at: string;
  circles?: Circle;
}

const Fridge = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const db: any = supabase;
  
  const [pins, setPins] = useState<FridgePin[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [adminCircles, setAdminCircles] = useState<Circle[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinType, setPinType] = useState("note");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  useEffect(() => {
    if (circles.length > 0) {
      fetchPins();
    }
  }, [circles, selectedCircle]);

  const fetchCircles = async () => {
    if (!user) return;

    const { data: ownedCircles } = await db.from("circles").select("*").eq("owner_id", user.id);

    const { data: memberCircles } = await db
      .from("circle_memberships")
      .select("circle_id, role, circles(*)")
      .eq("user_id", user.id);

    const allCircles: Circle[] = [];
    const adminList: Circle[] = [];

    if (ownedCircles) {
      allCircles.push(...ownedCircles);
      adminList.push(...ownedCircles);
    }

    if (memberCircles) {
      memberCircles.forEach((m: any) => {
        if (m.circles && !allCircles.find((c) => c.id === (m.circles as Circle).id)) {
          allCircles.push(m.circles as Circle);
        }
        if (m.role === "admin" && m.circles) {
          adminList.push(m.circles as Circle);
        }
      });
    }

    setCircles(allCircles);
    setAdminCircles(adminList);
    if (allCircles.length > 0 && !selectedCircle) {
      setSelectedCircle(allCircles[0].id);
    }
  };

  const fetchPins = async () => {
    if (circles.length === 0) return;

    // Filter by selected circle if one is selected
    const circleIds = selectedCircle ? [selectedCircle] : circles.map((c) => c.id);

    const { data, error } = await db
      .from("fridge_pins")
      .select(`*, circles!fridge_pins_circle_id_fkey(id, name)`)
      .in("circle_id", circleIds)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!error && data) {
      setPins(data as unknown as FridgePin[]);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const handleCreatePin = async () => {
    if (!title.trim() || !selectedCircle || !user) return;

    if (pins.length >= 8) {
      toast({
        title: "Fridge is full",
        description: "The fridge only supports up to 8 pinned photos. Remove one to add another.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    let imageUrl = null;

    if (selectedImage) {
      const fileExt = selectedImage.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await db.storage.from("post-media").upload(fileName, selectedImage);

      if (!uploadError) {
        const { data: publicUrlData } = db.storage.from("post-media").getPublicUrl(fileName);
        imageUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await db.from("fridge_pins").insert({
      title: title.trim(),
      content: content.trim() ? content.trim() : null,
      circle_id: selectedCircle,
      pinned_by: user.id,
      pin_type: pinType,
      image_url: imageUrl,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create pin. Make sure you're an admin of this circle.",
        variant: "destructive",
      });
    } else {
      resetForm();
      setIsCreateOpen(false);
      fetchPins();
      toast({
        title: "Pinned!",
        description: "Your item has been added to the fridge.",
      });
    }

    setIsCreating(false);
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setPinType("note");
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
  };

  const handleDeletePin = async (pin: FridgePin) => {
    if (!confirm(`Delete "${pin.title}" from the fridge?`)) return;

    const { error } = await db.from("fridge_pins").delete().eq("id", pin.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete pin.",
        variant: "destructive",
      });
    } else {
      fetchPins();
      toast({
        title: "Removed",
        description: "Pin has been removed from the fridge.",
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

  const isAdmin = adminCircles.length > 0;

  const getPinIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="w-4 h-4" />;
      case "event": return <Calendar className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <CircleHeader
        circles={circles}
        selectedCircle={selectedCircle}
        onCircleChange={setSelectedCircle}
        onSignOut={handleSignOut}
      />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-2">
              <Pin className="w-8 h-8" />
              Family Fridge
            </h1>
            <p className="text-muted-foreground mt-1">
              Important notes, photos, and reminders for your family
            </p>
          </div>
          {isAdmin && (
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Pin Something
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif">Pin to Fridge</DialogTitle>
                  <DialogDescription>
                    Add a note, photo, or reminder for your family.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Circle</Label>
                    <Select value={selectedCircle} onValueChange={setSelectedCircle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select circle" />
                      </SelectTrigger>
                      <SelectContent>
                        {adminCircles.map((circle) => (
                          <SelectItem key={circle.id} value={circle.id}>
                            {circle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={pinType} onValueChange={setPinType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="image">Photo</SelectItem>
                        <SelectItem value="event">Event/Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Grocery List"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content (optional)</Label>
                    <Textarea
                      id="content"
                      placeholder="Add details..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Image (optional)</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full aspect-video object-cover rounded-lg"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setSelectedImage(null);
                            URL.revokeObjectURL(imagePreview);
                            setImagePreview(null);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Image className="w-4 h-4 mr-2" />
                        Add Image
                      </Button>
                    )}
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleCreatePin}
                    disabled={!title.trim() || !selectedCircle || isCreating}
                  >
                    {isCreating ? "Pinning..." : "Pin to Fridge"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {pins.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Pin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Nothing on the fridge yet
              </h3>
              <p className="text-muted-foreground">
                {isAdmin 
                  ? "Pin important notes, photos, and reminders for your family."
                  : "Circle admins can pin items here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <FridgeBoard
            pins={pins as unknown as FridgeBoardPin[]}
            canDeleteCircleId={(circleId) => adminCircles.some((c) => c.id === circleId)}
            onDelete={(pin) => handleDeletePin(pin as unknown as FridgePin)}
          />
        )}
      </main>
      <MobileNavigation />
    </div>
  );
};

export default Fridge;
