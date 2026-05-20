import { useState, useEffect, useRef, useMemo } from "react";
import { useKeyboardDismissOnScroll } from "@/hooks/useKeyboardDismissOnScroll";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings, MapPin, ImagePlus, Trash2, Play, Download, Pencil, X, ChevronLeft, ChevronRight, Ban, Flag, Layers } from "lucide-react";
import { getMediaType } from "@/lib/mediaUtils";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { Textarea } from "@/components/ui/textarea";
import { convertHeicToJpeg } from "@/lib/heicConverter";
import AvatarCropDialog from "@/components/profile/AvatarCropDialog";
import { VideoThumbnail } from "@/components/shared/VideoThumbnail";
import { ZoomableImage } from "@/components/shared/ZoomableImage";

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
  group_id: string;
  position: number;
}

const MAX_GROUP_ITEMS = 4;

const ProfileView = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number>(0);
  useKeyboardDismissOnScroll(mainRef);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [images, setImages] = useState<ProfileImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [showCaptionInput, setShowCaptionInput] = useState(false);

  // Multi-file upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<{ url: string; isVideo: boolean }[]>([]);

  // Lightbox now opens a *group* (one post) with a slide index
  const [lightbox, setLightbox] = useState<{ group: ProfileImage[]; index: number } | null>(null);

  // Edit/Delete operate on whole group
  const [editingGroup, setEditingGroup] = useState<ProfileImage[] | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editCropSrc, setEditCropSrc] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isOwnProfile = user?.id === userId;
  const { blockUser, isBlocked } = useBlockedUsers();
  const [reportOpen, setReportOpen] = useState(false);
  const [avatarZoomOpen, setAvatarZoomOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const [profileRes, imagesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url, bio, location").eq("user_id", userId).single(),
        supabase.from("profile_images").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfileData(profileRes.data);
      if (imagesRes.data) setImages(imagesRes.data as ProfileImage[]);
      setIsLoading(false);
    };

    fetchData();
  }, [userId]);

  // Group images by group_id, newest group first, items inside ordered by position
  const groups = useMemo(() => {
    const map = new Map<string, ProfileImage[]>();
    const order: string[] = [];
    for (const img of images) {
      if (!map.has(img.group_id)) {
        map.set(img.group_id, []);
        order.push(img.group_id);
      }
      map.get(img.group_id)!.push(img);
    }
    return order.map((id) => {
      const items = map.get(id)!;
      items.sort((a, b) => a.position - b.position);
      return items;
    });
  }, [images]);

  // Cleanup pending preview blob URLs
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [pendingPreviews]);

  const resetUploadState = () => {
    pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setPendingFiles([]);
    setPendingPreviews([]);
    setUploadCaption("");
    setShowCaptionInput(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list || list.length === 0) return;
    event.target.value = "";

    // One file at a time, appended to existing pending items, capped at 4.
    const incoming = Array.from(list);
    const remaining = MAX_GROUP_ITEMS - pendingFiles.length;
    if (remaining <= 0) {
      toast({ title: `Maximum ${MAX_GROUP_ITEMS} items`, description: "Remove one to add another." });
      return;
    }
    let files = incoming.slice(0, remaining);
    if (incoming.length > remaining) {
      toast({ title: `Only ${MAX_GROUP_ITEMS} items allowed`, description: `Kept the first ${remaining}.` });
    }

    // HEIC convert sequentially
    const converted: File[] = [];
    for (const f of files) {
      try {
        converted.push(await convertHeicToJpeg(f));
      } catch {
        converted.push(f);
      }
    }

    // Keep the original media intact and show it in the full-screen composer immediately.
    const newPreviews = converted.map((f) => ({
      url: URL.createObjectURL(f),
      isVideo: f.type.startsWith("video/"),
    }));
    setPendingFiles((prev) => [...prev, ...converted]);
    setPendingPreviews((prev) => [...prev, ...newPreviews]);
    setShowCaptionInput(true);
  };

  const removePendingItem = (index: number) => {
    const removed = pendingPreviews[index];
    if (removed) URL.revokeObjectURL(removed.url);
    const nextCount = pendingFiles.length - 1;
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
    if (nextCount <= 0) {
      resetUploadState();
    }
  };

  const handleConfirmUpload = async () => {
    if (!user) return;
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setShowCaptionInput(false);

    const sharedCaption = uploadCaption.trim() || null;
    const groupId =
      (typeof crypto !== "undefined" && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const insertedRows: ProfileImage[] = [];
    const insertedStoragePaths: string[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const uploadData: Blob = file;
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${Date.now()}-${i}.${ext}`;
      const contentType = file.type;

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, uploadData, { contentType });

      if (uploadError) {
        toast({ title: `Upload failed for item ${i + 1}`, description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from("profile-images").getPublicUrl(fileName);

      const { data: newImage, error: insertError } = await supabase
        .from("profile_images")
        .insert({
          user_id: user.id,
          image_url: publicUrlData.publicUrl,
          caption: sharedCaption,
          group_id: groupId,
          position: i,
        })
        .select()
        .single();

      if (insertError) {
        toast({ title: "Error", description: "Could not save media.", variant: "destructive" });
        await supabase.storage.from("profile-images").remove([fileName]);
        continue;
      }

      if (newImage) {
        insertedRows.push(newImage as ProfileImage);
        insertedStoragePaths.push(fileName);
      }
    }

    if (insertedRows.length > 0) {
      // Prepend the whole new group at the top
      setImages((prev) => [...insertedRows, ...prev]);
      toast({ title: insertedRows.length > 1 ? `Posted ${insertedRows.length} items!` : "Media uploaded!" });

      // Silent background moderation per image
      const imageRows = insertedRows.filter((r) => getMediaType(r.image_url) === "image");
      if (imageRows.length > 0) {
        (async () => {
          try {
            const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-content", {
              body: { imageUrls: imageRows.map((r) => r.image_url) },
            });

            if (!modError && modResult && !modResult.allowed) {
              const ids = insertedRows.map((r) => r.id);
              await supabase.from("profile_images").delete().in("id", ids);
              await supabase.storage.from("profile-images").remove(insertedStoragePaths);
              setImages((prev) => prev.filter((i) => !ids.includes(i.id)));
              toast({
                title: "Post removed",
                description: "This post was removed because it may violate our community guidelines.",
                variant: "destructive",
              });
            }
          } catch (err) {
            console.error("Background moderation failed:", err);
          }
        })();
      }
    } else {
      toast({ title: "Upload failed", description: "No media was saved. Please try again.", variant: "destructive" });
    }

    setIsUploading(false);
    resetUploadState();
  };

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const { downloadFile } = await import("@/lib/nativeDownload");
      await downloadFile(url, filename || url.split("/").pop()?.split("?")[0]);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const extractStoragePath = (publicUrl: string): string | null => {
    // public URL is .../object/public/profile-images/<userId>/<file>
    const m = publicUrl.match(/\/profile-images\/(.+?)(?:\?|$)/);
    return m ? m[1] : null;
  };

  const handleDeleteGroup = async (group: ProfileImage[]) => {
    const ids = group.map((g) => g.id);
    const paths = group.map((g) => extractStoragePath(g.image_url)).filter((p): p is string => !!p);

    const { error } = await supabase.from("profile_images").delete().in("id", ids);
    if (error) {
      toast({ title: "Error", description: "Could not delete post.", variant: "destructive" });
      return;
    }
    if (paths.length > 0) {
      await supabase.storage.from("profile-images").remove(paths);
    }
    setImages((prev) => prev.filter((i) => !ids.includes(i.id)));
    setLightbox(null);
    toast({ title: "Post deleted" });
  };

  // Edit existing group (shared caption)
  const handleStartEdit = (group: ProfileImage[]) => {
    setEditingGroup(group);
    setEditCaption(group[0]?.caption || "");
    setLightbox(null);
  };

  const handleSaveEdit = async () => {
    if (!editingGroup || !user) return;
    setIsSavingEdit(true);

    const newCaption = editCaption.trim() || null;
    const ids = editingGroup.map((g) => g.id);
    const { error } = await supabase
      .from("profile_images")
      .update({ caption: newCaption })
      .in("id", ids);

    if (error) {
      toast({ title: "Error", description: "Could not update.", variant: "destructive" });
    } else {
      setImages((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, caption: newCaption } : i));
      toast({ title: "Updated!" });
      setEditingGroup(null);
    }
    setIsSavingEdit(false);
  };

  const handleEditRecrop = () => {
    if (!editingGroup || editingGroup.length !== 1) return;
    setEditCropSrc(editingGroup[0].image_url);
  };

  const handleEditCropComplete = async (blob: Blob) => {
    setEditCropSrc(null);
    if (!editingGroup || editingGroup.length !== 1 || !user) return;
    const target = editingGroup[0];
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
      .eq("id", target.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to update image.", variant: "destructive" });
    } else {
      setImages((prev) => prev.map((i) => i.id === target.id ? { ...i, image_url: publicUrlData.publicUrl } : i));
      setEditingGroup((prev) => prev ? prev.map((i) => i.id === target.id ? { ...i, image_url: publicUrlData.publicUrl } : i) : null);
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

  const currentSlide = lightbox ? lightbox.group[lightbox.index] : null;

  return (
    <main ref={mainRef} className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => profileData.avatar_url && setAvatarZoomOpen(true)}
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="View profile picture"
              disabled={!profileData.avatar_url}
            >
              <Avatar className="h-28 w-28 cursor-pointer hover:opacity-90 transition-opacity">
                <AvatarImage src={profileData.avatar_url || undefined} />
                <AvatarFallback className="text-3xl font-serif">
                  {profileData.display_name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {profileData.display_name || "Unknown"}
                </h1>
                {isOwnProfile && (
                  <div className="flex items-center gap-1">
                    <Link to="/settings">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
                {!isOwnProfile && userId && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setReportOpen(true)} title="Report">
                      <Flag className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Block user">
                          <Ban className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Block {profileData.display_name || "this user"}?</AlertDialogTitle>
                          <AlertDialogDescription>You won't see their posts, comments, or messages anymore. This also reports them to our team.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { blockUser(userId); navigate("/feed"); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Block</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.heic,.heif"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isOwnProfile ? "No photos or videos yet. Add some to your profile!" : "No photos or videos yet."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {groups.map((group) => {
                const cover = group[0];
                const isVideo = getMediaType(cover.image_url) === "video";
                const count = group.length;
                return (
                  <button
                    type="button"
                    key={group[0].group_id}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => setLightbox({ group, index: 0 })}
                    aria-label={count > 1 ? `Open post with ${count} items` : "Open post"}
                  >
                    {isVideo ? (
                      <VideoThumbnail src={cover.image_url} />
                    ) : (
                      <img src={cover.image_url} alt={cover.caption || "Profile photo"} className="w-full h-full object-contain bg-background" />
                    )}
                    {count > 1 && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-1.5 py-0.5 rounded-full pointer-events-none">
                        <Layers className="h-3 w-3" />
                        {count}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Avatar zoom lightbox */}
      <Dialog open={avatarZoomOpen} onOpenChange={setAvatarZoomOpen}>
        <DialogContent className="max-w-none sm:max-w-[95vw] sm:w-fit px-0 py-0 p-0 border-0 bg-black/95 sm:bg-background/95 sm:p-2 sm:border sm:rounded-lg [&>button:last-child]:hidden inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] rounded-none sm:rounded-lg flex flex-col items-center justify-center">
          <div className="absolute top-0 right-0 z-20 flex items-center gap-2 pr-4 pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3 sm:pr-4">
            <button
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
              onClick={() => setAvatarZoomOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {profileData?.avatar_url && (
            <ZoomableImage
              className="max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto flex items-center justify-center"
              onSwipeDown={() => setAvatarZoomOpen(false)}
            >
              <img
                src={profileData.avatar_url}
                alt={profileData.display_name || "Profile picture"}
                className="max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto object-contain select-none"
              />
            </ZoomableImage>
          )}
        </DialogContent>
      </Dialog>

      {/* Post lightbox — swipes within a single group */}
      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-none sm:max-w-[95vw] sm:w-fit px-0 py-0 p-0 border-0 bg-black/95 sm:bg-background/95 sm:p-2 sm:border sm:rounded-lg [&>button:last-child]:hidden inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] rounded-none sm:rounded-lg flex flex-col items-center justify-center">
          {lightbox && currentSlide && (
            <>
              {/* Top control bar — safe area aware on mobile */}
              <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-end gap-2 px-4 pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3 sm:pr-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60"
                  onClick={() => handleDownload(currentSlide.image_url)}
                  aria-label="Download"
                >
                  <Download className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60"
                  onClick={() => setLightbox(null)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Centered media */}
              {getMediaType(currentSlide.image_url) === 'video' ? (
                <video
                  key={currentSlide.id}
                  src={currentSlide.image_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto object-contain select-none"
                  onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; (touchStartX as any).__y = e.touches[0].clientY; }}
                  onTouchEnd={(e) => {
                    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
                    const deltaY = e.changedTouches[0].clientY - ((touchStartX as any).__y || 0);
                    if (deltaY > 80 && Math.abs(deltaX) < 50) { setLightbox(null); return; }
                    if (deltaX > 50 && lightbox.index < lightbox.group.length - 1) setLightbox({ ...lightbox, index: lightbox.index + 1 });
                    else if (deltaX < -50 && lightbox.index > 0) setLightbox({ ...lightbox, index: lightbox.index - 1 });
                  }}
                />
              ) : (
                <ZoomableImage
                  className="max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto flex items-center justify-center"
                  onSwipeLeft={() => lightbox.index < lightbox.group.length - 1 && setLightbox({ ...lightbox, index: lightbox.index + 1 })}
                  onSwipeRight={() => lightbox.index > 0 && setLightbox({ ...lightbox, index: lightbox.index - 1 })}
                  onSwipeDown={() => setLightbox(null)}
                >
                  <img
                    key={currentSlide.id}
                    src={currentSlide.image_url}
                    alt={currentSlide.caption || "Profile photo"}
                    className="max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto object-contain select-none"
                  />
                </ZoomableImage>
              )}

              {/* Navigation arrows + counter (within group) */}
              {lightbox.group.length > 1 && (
                <>
                  {lightbox.index > 0 && (
                    <button
                      className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                      onClick={() => setLightbox({ ...lightbox, index: lightbox.index - 1 })}
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                  )}
                  {lightbox.index < lightbox.group.length - 1 && (
                    <button
                      className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                      onClick={() => setLightbox({ ...lightbox, index: lightbox.index + 1 })}
                      aria-label="Next slide"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  )}
                  <div className="absolute bottom-6 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full" style={{ marginBottom: "max(env(safe-area-inset-bottom, 0px), 0px)" }}>
                    {lightbox.index + 1} / {lightbox.group.length}
                  </div>
                </>
              )}

              {/* Caption & actions (shared across the group) */}
              {(profileData?.display_name || currentSlide.caption || isOwnProfile) && (
                <div className="absolute bottom-14 sm:bottom-auto sm:relative sm:mt-3 z-10 flex flex-col items-center px-4">
                  {(profileData?.display_name || currentSlide.caption) && (
                    <p className="text-sm text-white/80 sm:text-muted-foreground text-center">
                      {profileData?.display_name && (
                        <span className="font-semibold text-white sm:text-foreground">{profileData.display_name}: </span>
                      )}
                      {currentSlide.caption}
                    </p>
                  )}
                  {isOwnProfile && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-black/40 border-white/20 text-white hover:bg-black/60 hover:text-white sm:bg-background sm:border-input sm:text-foreground sm:hover:bg-accent sm:hover:text-accent-foreground"
                        onClick={() => handleStartEdit(lightbox.group)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {lightbox.group.length > 1
                                ? `This will remove all ${lightbox.group.length} items in this post. This can't be undone.`
                                : "This will remove this item. This can't be undone."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteGroup(lightbox.group)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Crop dialog — only for single-image uploads */}
      {cropSrc && (
        <AvatarCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onClose={() => { setCropSrc(null); resetUploadState(); }}
          onCropComplete={handleCropComplete}
          aspect={1}
          cropShape="rect"
          title="Crop Photo"
        />
      )}

      {/* Add-more prompt — bridges between selecting a photo and the caption step */}
      <Dialog open={showAddMorePrompt && pendingFiles.length > 0} onOpenChange={(open) => { if (!open) setShowAddMorePrompt(false); }}>
        <DialogContent className="max-w-sm max-h-[min(92svh,560px)] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold">
              {pendingFiles.length === 1 ? "Add more to a carousel?" : `${pendingFiles.length}/${MAX_GROUP_ITEMS} items`}
            </h3>
            <p className="text-sm text-muted-foreground">
              You can post up to {MAX_GROUP_ITEMS} photos or videos together. Add them one at a time.
            </p>
            {pendingPreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 pb-1">
                {pendingPreviews.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                    {p.isVideo ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/80"><Play className="h-5 w-5 text-white" /></div>
                    ) : (
                      <img src={p.url} alt={`Selected ${i + 1}`} className="w-full h-full object-contain bg-background" />
                    )}
                    <button type="button" onClick={() => removePendingItem(i)} className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5" aria-label={`Remove item ${i + 1}`}>
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] font-medium px-1 rounded">
                      {i + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {pendingFiles.length < MAX_GROUP_ITEMS && (
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Add another ({pendingFiles.length}/{MAX_GROUP_ITEMS})
                </Button>
              )}
              <Button onClick={() => { setShowAddMorePrompt(false); setShowCaptionInput(true); }} disabled={pendingFiles.length === 0}>
                Continue to caption
              </Button>
              <Button variant="ghost" onClick={() => resetUploadState()}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Caption Input Dialog (shared caption for the whole post) */}
      <Dialog open={showCaptionInput} onOpenChange={(open) => { if (!open) setShowCaptionInput(false); }}>
        <DialogContent className="max-w-md max-h-[min(92svh,600px)] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold">
              {pendingFiles.length > 1 ? `Add a caption (${pendingFiles.length} items)` : "Add a caption"}
            </h3>

            {pendingPreviews.length >= 1 && (
              <div className="grid grid-cols-4 gap-2 pb-1">
                {pendingPreviews.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                    {p.isVideo ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/80">
                        <Play className="h-5 w-5 text-white" />
                      </div>
                    ) : (
                      <img src={p.url} alt={`Selected ${i + 1}`} className="w-full h-full object-contain bg-background" />
                    )}
                    <button
                      type="button"
                      onClick={() => removePendingItem(i)}
                      disabled={isUploading}
                      className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5"
                      aria-label={`Remove item ${i + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] font-medium px-1 rounded">
                      {i + 1}
                    </div>
                  </div>
                ))}
                {pendingFiles.length < MAX_GROUP_ITEMS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="aspect-square rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground transition-colors"
                    aria-label="Add another item"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px] mt-0.5">{pendingFiles.length}/{MAX_GROUP_ITEMS}</span>
                  </button>
                )}
              </div>
            )}

            <Textarea
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Write a caption (optional)..."
              className="resize-none"
              rows={3}
              maxLength={500}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => resetUploadState()}>
                Cancel
              </Button>
              <Button onClick={handleConfirmUpload} disabled={isUploading || pendingFiles.length === 0}>
                {isUploading ? "Uploading..." : (pendingFiles.length > 1 ? `Post ${pendingFiles.length} items` : "Upload")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit existing post dialog (shared caption) */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => { if (!open) setEditingGroup(null); }}>
        <DialogContent className="max-w-md">
          {editingGroup && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold">
                {editingGroup.length > 1 ? `Edit post (${editingGroup.length} items)` : "Edit Photo"}
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {editingGroup.map((item, i) => (
                  <div key={item.id} className="relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted">
                    {getMediaType(item.image_url) === "video" ? (
                      <VideoThumbnail src={item.image_url} />
                    ) : (
                      <img src={item.image_url} alt={`Item ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
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
                {editingGroup.length === 1 && getMediaType(editingGroup[0].image_url) === 'image' && (
                  <Button variant="outline" size="sm" onClick={handleEditRecrop} disabled={isSavingEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Re-crop
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                    {isSavingEdit ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Re-crop dialog for existing single-image post */}
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

      {userId && !isOwnProfile && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          reportedUserId={userId}
        />
      )}
    </main>
  );
};

export default ProfileView;
