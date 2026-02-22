import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings, MapPin, ImagePlus, Trash2 } from "lucide-react";

interface ProfileData {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
}

interface ProfileImage {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

const ProfileView = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [images, setImages] = useState<ProfileImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<ProfileImage | null>(null);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const [profileRes, imagesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url, bio, location").eq("user_id", userId).single(),
        supabase.from("profile_images").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfileData(profileRes.data);
      if (imagesRes.data) setImages(imagesRes.data);
      setIsLoading(false);
    };

    fetchData();
  }, [userId]);

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    event.target.value = "";

    setIsUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setIsUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("profile-images").getPublicUrl(fileName);

    const { data: newImage, error: insertError } = await supabase
      .from("profile_images")
      .insert({ user_id: user.id, image_url: publicUrlData.publicUrl })
      .select()
      .single();

    if (insertError) {
      toast({ title: "Error", description: "Could not save image.", variant: "destructive" });
    } else if (newImage) {
      setImages((prev) => [newImage, ...prev]);
      toast({ title: "Image uploaded!" });
    }

    setIsUploading(false);
  };

  const handleDeleteImage = async (image: ProfileImage) => {
    const { error } = await supabase.from("profile_images").delete().eq("id", image.id);
    if (error) {
      toast({ title: "Error", description: "Could not delete image.", variant: "destructive" });
    } else {
      setImages((prev) => prev.filter((i) => i.id !== image.id));
      setEnlargedImage(null);
      toast({ title: "Image deleted" });
    }
  };

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-28 w-28 rounded-full" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!profileData) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Profile not found.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-28 w-28">
              <AvatarImage src={profileData.avatar_url || undefined} />
              <AvatarFallback className="text-3xl font-serif">
                {profileData.display_name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {profileData.display_name || "Unknown"}
                </h1>
                {isOwnProfile && (
                  <Link to="/settings">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
              {profileData.location && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {profileData.location}
                </p>
              )}
              {profileData.bio && (
                <p className="text-foreground mt-2 max-w-md">{profileData.bio}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-lg">Photos</CardTitle>
            {isOwnProfile && (
              <>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Add Photo"}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isOwnProfile ? "No photos yet. Add some to your profile!" : "No photos yet."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setEnlargedImage(img)}
                >
                  <img src={img.image_url} alt={img.caption || "Profile photo"} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Lightbox */}
      <Dialog open={!!enlargedImage} onOpenChange={(open) => !open && setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background/95">
          {enlargedImage && (
            <div className="flex flex-col items-center">
              <img
                src={enlargedImage.image_url}
                alt={enlargedImage.caption || "Profile photo"}
                className="max-h-[80vh] w-auto object-contain rounded-lg"
              />
              {enlargedImage.caption && (
                <p className="mt-3 text-sm text-muted-foreground">{enlargedImage.caption}</p>
              )}
              {isOwnProfile && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  onClick={() => handleDeleteImage(enlargedImage)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Photo
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default ProfileView;
