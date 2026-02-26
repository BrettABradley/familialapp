import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FridgeBoard, type FridgeBoardPin } from "@/components/fridge/FridgeBoard";
import { Plus, Pin, Image, FileText, Calendar, Users, Mic } from "lucide-react";
import { VoiceRecorder } from "@/components/shared/VoiceRecorder";
import ReadOnlyBanner from "@/components/circles/ReadOnlyBanner";
import { convertHeicToJpeg } from "@/lib/heicConverter";

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
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: contextLoading, isCircleReadOnly } = useCircleContext();
  const readOnly = isCircleReadOnly(selectedCircle);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  
  const [pins, setPins] = useState<FridgePin[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinType, setPinType] = useState("note");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(true);

  useEffect(() => {
    if (circles.length > 0) {
      fetchPins();
    } else if (!contextLoading) {
      setIsLoadingPins(false);
    }
  }, [circles, selectedCircle, contextLoading]);

  const fetchPins = async () => {
    if (circles.length === 0) return;

    setIsLoadingPins(true);
    const circleIds = selectedCircle ? [selectedCircle] : circles.map((c) => c.id);

    const { data, error } = await supabase
      .from("fridge_pins")
      .select(`*, circles!fridge_pins_circle_id_fkey(id, name)`)
      .in("circle_id", circleIds)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!error && data) {
      setPins(data as unknown as FridgePin[]);
    }
    setIsLoadingPins(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;
    file = await convertHeicToJpeg(file);

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

      const { error: uploadError } = await supabase.storage.from("post-media").upload(fileName, selectedImage);

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("post-media").getPublicUrl(fileName);
        imageUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await supabase.from("fridge_pins").insert({
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
        description: "Failed to create pin.",
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

    const { error } = await supabase.from("fridge_pins").delete().eq("id", pin.id);

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

  if (contextLoading || isLoadingPins) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-9 w-40 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
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
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              Create a Circle First
            </h2>
            <p className="text-muted-foreground mb-6">
              You need to create or join a circle before using the fridge.
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
      <ReadOnlyBanner circleId={selectedCircle} />
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
        {!readOnly && (
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
              <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 mt-4 pr-4">
                <div className="space-y-2">
                  <Label>Circle</Label>
                  <Select value={selectedCircle} onValueChange={setSelectedCircle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select circle" />
                    </SelectTrigger>
                    <SelectContent>
                      {circles.map((circle) => (
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
                      <SelectItem value="voice_note">Voice Note</SelectItem>
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
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Description (optional, max 150 chars)</Label>
                  <Textarea
                    id="content"
                    placeholder="Add details..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    maxLength={150}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{pinType === 'voice_note' ? 'Voice Note' : 'Image (optional)'}</Label>
                  {pinType === 'voice_note' ? (
                    <>
                      {imagePreview ? (
                        <div className="p-3 bg-secondary rounded-lg space-y-2">
                          <audio controls src={imagePreview} className="w-full" />
                          <Button
                            variant="secondary"
                            size="sm"
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
                        <div className="space-y-2">
                          <VoiceRecorder onRecordingComplete={(blob) => {
                            const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
                            setSelectedImage(file);
                            setImagePreview(URL.createObjectURL(file));
                          }} />
                          <div className="text-xs text-muted-foreground">Or upload an audio file:</div>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleImageSelect}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.heic,.heif"
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
                    </>
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
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {pins.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Pin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              Nothing on the fridge yet
            </h2>
            <p className="text-muted-foreground">
              Pin important notes, photos, and reminders for your family.
            </p>
          </CardContent>
        </Card>
      ) : (
        <FridgeBoard
          pins={pins as unknown as FridgeBoardPin[]}
          canDelete={(pin) => pin.pinned_by === user?.id || circles.some(c => c.id === pin.circle_id && c.owner_id === user?.id)}
          onDelete={(pin) => handleDeletePin(pin as unknown as FridgePin)}
          circleName={selectedCircle ? circles.find(c => c.id === selectedCircle)?.name : undefined}
        />
      )}
    </main>
  );
};

export default Fridge;
