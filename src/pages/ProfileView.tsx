import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings, MapPin, ImagePlus, Trash2, Play, Download, Pencil } from "lucide-react";
import { getMediaType } from "@/lib/mediaUtils";
import { Textarea } from "@/components/ui/textarea";
import { convertHeicToJpeg } from "@/lib/heicConverter";
import AvatarCropDialog from "@/components/profile/AvatarCropDialog";

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
  const [uploadCaption, setUploadCaption] = useState("");
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Crop state for new uploads
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  // Edit state for existing images
  const [editingImage, setEditingImage] = useState<ProfileImage | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editCropSrc, setEditCropSrc] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    let file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    file = await convertHeicToJpeg(file);

    const mediaType = file.type.split("/")[0];
    if (mediaType === "image") {
      // Open crop dialog for images
      const url = URL.createObjectURL(file);
      setCropSrc(url);
      setPendingFile(file);
    } else {
      // For videos, skip crop
      setPendingFile(file);
      setCroppedBlob(null);
      setUploadCaption("");
      setShowCaptionInput(true);
    }
  };

  const handleCropComplete = (blob: Blob) => {
    setCropSrc(null);
    setCroppedBlob(blob);
    setUploadCaption("");
    setShowCaptionInput(true);
  };

  const handleConfirmUpload = async () => {
    if (!user) return;
    const uploadData = croppedBlob || pendingFile;
    if (!uploadData) return;

    setIsUploading(true);
    setShowCaptionInput(false);
    const ext = croppedBlob ? "jpg" : (pendingFile?.name.split(".").pop() || "jpg");
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, uploadData, { contentType: croppedBlob ? "image/jpeg" : pendingFile?.type });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setIsUploading(false);
      setPendingFile(null);
      setCroppedBlob(null);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("profile-images").getPublicUrl(fileName);

    const { data: newImage, error: insertError } = await supabase
      .from("profile_images")
      .insert({ user_id: user.id, image_url: publicUrlData.publicUrl, caption: uploadCaption.trim() || null })
      .select()
      .single();

    if (insertError) {
      toast({ title: "Error", description: "Could not save media.", variant: "destructive" });
    } else if (newImage) {
      setImages((prev) => [newImage, ...prev]);
      toast({ title: "Media uploaded!" });

      // Silent background moderation
      const imageId = newImage.id;
      const imageUrl = publicUrlData.publicUrl;
      const storagePath = fileName;

      (async () => {
        try {
          const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-content", {
            body: { imageUrls: [imageUrl] },
          });

          if (!modError && modResult && !modResult.allowed) {
            await supabase.from("profile_images").delete().eq("id", imageId);
            await supabase.storage.from("profile-images").remove([storagePath]);
            setImages((prev) => prev.filter((i) => i.id !== imageId));
            toast({
              title: "Image removed",
              description: "This image was removed because it may violate our community guidelines.",
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error("Background moderation failed:", err);
        }
      })();
    }

    setIsUploading(false);
    setPendingFile(null);
    setCroppedBlob(null);
    setUploadCaption("");
  };

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename || url.split("/").pop() || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
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

  // Edit existing image
  const handleStartEdit = (image: ProfileImage) => {
    setEditingImage(image);
    setEditCaption(image.caption || "");
    setEnlargedImage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingImage || !user) return;
    setIsSavingEdit(true);

    const { error } = await supabase
      .from("profile_images")
      .update({ caption: editCaption.trim() || null })
      .eq("id", editingImage.id);

    if (error) {
      toast({ title: "Error", description: "Could not update.", variant: "destructive" });
    } else {
      setImages((prev) => prev.map((i) => i.id === editingImage.id ? { ...i, caption: editCaption.trim() || null } : i));
      toast({ title: "Updated!" });
      setEditingImage(null);
    }
    setIsSavingEdit(false);
  };

  const handleEditRecrop = () => {
    if (!editingImage) return;
    setEditCropSrc(editingImage.image_url);
  };

  const handleEditCropComplete = async (blob: Blob) => {
    setEditCropSrc(null);
    if (!editingImage || !user) return;
    setIsSavingEdit(true);

    const fileName = `${user.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, blob, { contentType: "image/jpeg" });

    if (uploadError) {
      toast({ title: "Error", description: "Failed to upload cropped image.", variant: "destructive" });
      setIsSavingEdit(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("profile-images").getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("profile_images")
      .update({ image_url: publicUrlData.publicUrl })
      .eq("id", editingImage.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to update image.", variant: "destructive" });
    } else {
      setImages((prev) => prev.map((i) => i.id === editingImage.id ? { ...i, image_url: publicUrlData.publicUrl } : i));
      setEditingImage((prev) => prev ? { ...prev, image_url: publicUrlData.publicUrl } : null);
      toast({ title: "Image updated!" });
    }
    setIsSavingEdit(false);
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
                  {isUploading ? "Uploading..." : "Add Media"}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,.heic,.heif" onChange={handleFileSelect} className="hidden" />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isOwnProfile ? "No photos or videos yet. Add some to your profile!" : "No photos or videos yet."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => {
                const mediaType = getMediaType(img.image_url);
                return (
                  <div
                    key={img.id}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative"
                    onClick={() => setEnlargedImage(img)}
                  >
                    {mediaType === 'video' ? (
                      <>
                        <video src={img.image_url} className="w-full h-full object-cover" muted preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white fill-white" />
                        </div>
                      </>
                    ) : (
                      <img src={img.image_url} alt={img.caption || "Profile photo"} className="w-full h-full object-cover" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Lightbox */}
      <Dialog open={!!enlargedImage} onOpenChange={(open) => !open && setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background/95">
          {enlargedImage && (
            <div className="flex flex-col items-center">
              <div className="relative group">
                {getMediaType(enlargedImage.image_url) === 'video' ? (
                  <video
                    src={enlargedImage.image_url}
                    controls
                    autoPlay
                    className="max-h-[80vh] w-auto rounded-lg"
                  />
                ) : (
                  <img
                    src={enlargedImage.image_url}
                    alt={enlargedImage.caption || "Profile photo"}
                    className="max-h-[80vh] w-auto object-contain rounded-lg"
                  />
                )}
                <button
                  onClick={() => handleDownload(enlargedImage.image_url)}
                  className="absolute bottom-2 right-2 bg-background/80 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                  aria-label="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              {(profileData?.display_name || enlargedImage.caption) && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {profileData?.display_name && (
                    <span className="font-semibold text-foreground">{profileData.display_name}: </span>
                  )}
                  {enlargedImage.caption}
                </p>
              )}
              {isOwnProfile && (
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartEdit(enlargedImage)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteImage(enlargedImage)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Crop dialog for new uploads */}
      {cropSrc && (
        <AvatarCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onClose={() => { setCropSrc(null); setPendingFile(null); }}
          onCropComplete={handleCropComplete}
          aspect={1}
          cropShape="rect"
          title="Crop Photo"
        />
      )}

      {/* Caption Input Dialog */}
      <Dialog open={showCaptionInput} onOpenChange={(open) => { if (!open) { setShowCaptionInput(false); setPendingFile(null); setCroppedBlob(null); } }}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold">Add a caption</h3>
            <Textarea
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Write a caption (optional)..."
              className="resize-none"
              rows={3}
              maxLength={500}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowCaptionInput(false); setPendingFile(null); setCroppedBlob(null); }}>
                Cancel
              </Button>
              <Button onClick={handleConfirmUpload} disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit existing image dialog */}
      <Dialog open={!!editingImage} onOpenChange={(open) => { if (!open) setEditingImage(null); }}>
        <DialogContent className="max-w-md">
          {editingImage && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold">Edit Photo</h3>
              <div className="rounded-lg overflow-hidden aspect-square max-h-48 mx-auto">
                <img src={editingImage.image_url} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <Textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Edit caption..."
                className="resize-none"
                rows={3}
                maxLength={500}
              />
              <div className="flex gap-2 justify-between">
                {getMediaType(editingImage.image_url) === 'image' && (
                  <Button variant="outline" size="sm" onClick={handleEditRecrop} disabled={isSavingEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Re-crop
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={() => setEditingImage(null)}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                    {isSavingEdit ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Re-crop dialog for existing images */}
      {editCropSrc && (
        <AvatarCropDialog
          open={!!editCropSrc}
          imageSrc={editCropSrc}
          onClose={() => setEditCropSrc(null)}
          onCropComplete={handleEditCropComplete}
          aspect={1}
          cropShape="rect"
          title="Re-crop Photo"
        />
      )}
    </main>
  );
};

export default ProfileView;
