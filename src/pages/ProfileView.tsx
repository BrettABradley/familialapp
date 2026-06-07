import { useState, useEffect, useRef, useMemo, type VideoHTMLAttributes } from "react";
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
import { pickImage } from "@/lib/imagePicker";
import { Capacitor } from "@capacitor/core";
import AvatarCropDialog from "@/components/profile/AvatarCropDialog";
import { VideoThumbnail } from "@/components/shared/VideoThumbnail";
import { ZoomableImage } from "@/components/shared/ZoomableImage";
import { SquareImageThumbnail } from "@/components/shared/SquareMediaThumbnail";
import { SquareSignedThumbnail } from "@/components/shared/SquareSignedThumbnail";
import { SignedSmartImage } from "@/components/shared/SignedSmartImage";
import { useSignedMediaUrl, getPostMediaUrl, getPostMediaUrls, toBucketPath } from "@/lib/postMediaUrl";
import { PRESET_TRANSFORM } from "@/lib/imageUrl";
import useEmblaCarousel from "embla-carousel-react";

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

const MAX_GROUP_ITEMS = 5;
const PROFILE_BUCKET = "profile-images";

/** Normalize a stored profile_images.image_url (legacy public URL or bare path)
 *  into a bare storage path. Returns the input unchanged for blob/data URLs. */
const toProfilePath = (value: string): string => {
  if (!value) return value;
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;
  return toBucketPath(value, PROFILE_BUCKET) ?? value;
};

/** Inline <video> that resolves a bare storage path to a signed URL on the fly. */
const SignedVideo = ({ path, ...rest }: { path: string } & VideoHTMLAttributes<HTMLVideoElement>) => {
  const { url } = useSignedMediaUrl(path, undefined, PROFILE_BUCKET);
  if (!url) return <div className="h-full w-full bg-muted" aria-busy />;
  return <video src={url} {...rest} />;
};

/** Inline <VideoThumbnail> that resolves a bare path to a signed URL first. */
const SignedVideoThumbnail = ({ path }: { path: string }) => {
  const { url } = useSignedMediaUrl(path, undefined, PROFILE_BUCKET);
  if (!url) return <div className="h-full w-full bg-muted" aria-busy />;
  return <VideoThumbnail src={url} />;
};


const ProfileMediaLightbox = ({
  group,
  startIndex,
  onIndexChange,
  onClose,
  onDownload,
}: {
  group: ProfileImage[];
  startIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDownload: (url: string) => void;
}) => {
  const zoomedRef = useRef(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "center", duration: 34, dragThreshold: 4, containScroll: "trimSnaps", startIndex, watchDrag: () => !zoomedRef.current });
  const [selected, setSelected] = useState(startIndex);
  const current = group[selected];

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setSelected(index);
      onIndexChange(index);
      zoomedRef.current = false;
    };
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onIndexChange]);

  return (
    <>
      <div className="pointer-events-auto absolute top-0 left-0 right-0 z-50 flex items-center justify-end gap-2 pl-[max(env(safe-area-inset-left,0px),1rem)] pr-[max(env(safe-area-inset-right,0px),1rem)] pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3">
        {current && <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60" onClick={() => onDownload(current.image_url)} aria-label="Download"><Download className="h-5 w-5" /></Button>}
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
      </div>
      <div className="h-[100dvh] w-screen overflow-hidden sm:h-[90vh] sm:w-[90vw]" ref={emblaRef}>
        <div className="flex h-full touch-pan-y will-change-transform">
          {group.map((item, index) => {
            const isCurrent = index === selected;
            return (
              <div key={item.id} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center px-2">
                {getMediaType(item.image_url) === "video" ? (
                  <SignedVideo path={item.image_url} controls autoPlay={isCurrent} playsInline className="max-h-full max-w-full select-none object-contain" />
                ) : (
                  <ZoomableImage
                    className="w-full h-full flex items-center justify-center"
                    onScaleChange={(s) => { if (isCurrent) zoomedRef.current = s > 1.05; }}
                  >
                    <SignedSmartImage path={item.image_url} bucket={PROFILE_BUCKET} preset="full" transformImage={false} resolveAsBlob priority={Math.abs(index - selected) <= 1} alt={item.caption || "Profile photo"} className="max-h-full max-w-full select-none bg-transparent object-contain" />
                  </ZoomableImage>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {group.length > 1 && (
        <>
          {selected > 0 && <button className="hidden sm:flex absolute left-4 top-1/2 z-30 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous slide"><ChevronLeft className="h-6 w-6" /></button>}
          {selected < group.length - 1 && <button className="hidden sm:flex absolute right-4 top-1/2 z-30 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60" onClick={() => emblaApi?.scrollNext()} aria-label="Next slide"><ChevronRight className="h-6 w-6" /></button>}
          <div className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white backdrop-blur-sm" style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}>{selected + 1} / {group.length}</div>
        </>
      )}
    </>
  );
};

const ProfileView = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
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
  const [pendingCrop, setPendingCrop] = useState<{ src: string; file: File } | null>(null);
  const [isPreparingCrop, setIsPreparingCrop] = useState(false);

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
  const { url: avatarSignedUrl } = useSignedMediaUrl(profileData?.avatar_url, PRESET_TRANSFORM.avatar, "avatars");

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const [profileRes, imagesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url, bio, location").eq("user_id", userId).single(),
        supabase.from("profile_images").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfileData(profileRes.data);
      if (imagesRes.data) {
        const rows = (imagesRes.data as ProfileImage[]).map((r) => ({ ...r, image_url: toProfilePath(r.image_url) }));
        setImages(rows);
      }
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

  // Cleanup pending preview blob URLs on unmount only.
  // (Per-item revocation is handled by removePendingItem / resetUploadState.)
  const pendingPreviewsRef = useRef(pendingPreviews);
  useEffect(() => {
    pendingPreviewsRef.current = pendingPreviews;
  }, [pendingPreviews]);
  useEffect(() => {
    return () => {
      pendingPreviewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const resetUploadState = () => {
    pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setPendingFiles([]);
    setPendingPreviews([]);
    setUploadCaption("");
    setShowCaptionInput(false);
    setPendingCrop(null);
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

  const preparePhotoCrop = async (selectedFile: File) => {
    if (selectedFile.type.startsWith("video/")) {
      await addPendingFile(selectedFile);
      return;
    }
    setIsPreparingCrop(true);
    try {
      const displayFile = await convertHeicToJpeg(selectedFile);
      const src = await readFileAsDataUrl(displayFile);
      setPendingCrop({ src, file: displayFile });
    } catch {
      toast({ title: "Could not prepare photo", description: "Please try a different image.", variant: "destructive" });
    } finally {
      setIsPreparingCrop(false);
    }
  };

  const addPendingFile = async (selectedFile: File) => {
    const remaining = MAX_GROUP_ITEMS - pendingFiles.length;
    if (remaining <= 0) {
      toast({ title: `Maximum ${MAX_GROUP_ITEMS} items`, description: "Remove one to add another." });
      return;
    }

    // Open the composer immediately; convert/downscale in the background so iOS never feels like the upload vanished.
    const previewUrl = URL.createObjectURL(selectedFile);
    setShowCaptionInput(true);
    setPendingFiles((prev) => [...prev, selectedFile]);
    setPendingPreviews((prev) => [...prev, {
      url: previewUrl,
      isVideo: selectedFile.type.startsWith("video/"),
    }]);

    try {
      const convertedFile = await convertHeicToJpeg(selectedFile);
      if (convertedFile !== selectedFile) {
        const stillPending = pendingPreviewsRef.current.some((preview) => preview.url === previewUrl);
        if (!stillPending) {
          URL.revokeObjectURL(previewUrl);
          return;
        }

        setPendingFiles((prev) => prev.map((file) => file === selectedFile ? convertedFile : file));
        const convertedPreviewUrl = URL.createObjectURL(convertedFile);
        setPendingPreviews((prev) => prev.map((preview) => {
          if (preview.url !== previewUrl) return preview;
          return {
            url: convertedPreviewUrl,
            isVideo: convertedFile.type.startsWith("video/"),
          };
        }));
        URL.revokeObjectURL(previewUrl);
      }
    } catch {
      // Keep the original file selected if conversion fails; the user can still continue or remove it.
    }
  };

  const handleAddMediaClick = async () => {
    if (isUploading) return;
    if (pendingFiles.length >= MAX_GROUP_ITEMS) {
      toast({ title: `Maximum ${MAX_GROUP_ITEMS} items`, description: "Remove one to add another." });
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const picked = await pickImage();
        if (picked) await preparePhotoCrop(picked.file);
      } catch {
        toast({ title: "Could not open photos", description: "Please try again.", variant: "destructive" });
      }
      return;
    }

    // Web: reset value before opening so re-selecting the same file still fires onChange.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    await preparePhotoCrop(selectedFile);
    // Clear after processing so the same file can be re-picked next time.
    if (event.target) event.target.value = "";
  };

  const handlePendingCropComplete = async (blob: Blob) => {
    const sourceName = pendingCrop?.file.name || "profile-photo.jpg";
    setPendingCrop(null);
    const croppedFile = new File(
      [blob],
      sourceName.replace(/\.[^/.]+$/, ".jpg"),
      { type: "image/jpeg" }
    );
    await addPendingFile(croppedFile);
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
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
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
      // Store bare storage paths in state; SignedSmartImage signs on render.
      const pathRows = insertedRows.map((r) => ({ ...r, image_url: toProfilePath(r.image_url) }));
      // Prepend the whole new group at the top
      setImages((prev) => [...pathRows, ...prev]);
      toast({ title: pathRows.length > 1 ? `Posted ${pathRows.length} items!` : "Media uploaded!" });

      // Silent background moderation per image — sign just-in-time so the
      // edge function can fetch the private-bucket asset.
      const imagePaths = pathRows.filter((r) => getMediaType(r.image_url) === "image").map((r) => r.image_url);
      if (imagePaths.length > 0) {
        (async () => {
          try {
            const signedUrls = (await getPostMediaUrls(imagePaths, undefined, PROFILE_BUCKET)).filter(Boolean);
            if (signedUrls.length === 0) return;
            const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-content", {
              body: { imageUrls: signedUrls },
            });

            if (!modError && modResult && !modResult.allowed) {
              const ids = pathRows.map((r) => r.id);
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

  const handleDownload = async (pathOrUrl: string, filename?: string) => {
    try {
      // The grid + lightbox store bare storage paths; resolve to a signed URL
      // before handing off to the native/web downloader.
      const url = await getPostMediaUrl(pathOrUrl, undefined, PROFILE_BUCKET);
      if (!url) throw new Error("Could not resolve download URL");
      const { downloadFile } = await import("@/lib/nativeDownload");
      await downloadFile(url, filename || pathOrUrl.split("/").pop()?.split("?")[0]);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleDeleteGroup = async (group: ProfileImage[]) => {
    const ids = group.map((g) => g.id);
    // image_url is already a bare storage path after the fetch normalization.
    const paths = group
      .map((g) => (g.image_url && !g.image_url.startsWith("blob:") && !g.image_url.startsWith("data:") ? g.image_url : null))
      .filter((p): p is string => !!p);

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

  const handleEditRecrop = async () => {
    if (!editingGroup || editingGroup.length !== 1) return;
    const url = await getPostMediaUrl(editingGroup[0].image_url, undefined, PROFILE_BUCKET);
    if (!url) {
      toast({ title: "Could not load image", variant: "destructive" });
      return;
    }
    setEditCropSrc(url);
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
      const newPath = toProfilePath(publicUrlData.publicUrl);
      setImages((prev) => prev.map((i) => i.id === target.id ? { ...i, image_url: newPath } : i));
      setEditingGroup((prev) => prev ? prev.map((i) => i.id === target.id ? { ...i, image_url: newPath } : i) : null);
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
                <AvatarImage src={avatarSignedUrl || undefined} />
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
                <Button variant="outline" size="sm" onClick={handleAddMediaClick} disabled={isUploading || isPreparingCrop}>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : isPreparingCrop ? "Preparing..." : "Add Media"}
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
                      <SignedVideoThumbnail path={cover.image_url} />
                    ) : (
                      <SquareSignedThumbnail path={cover.image_url} bucket={PROFILE_BUCKET} transformImage={false} resolveAsBlob alt={cover.caption || "Profile photo"} />
                    )}
                    {count > 1 && (
                      <div
                        className="absolute top-1 right-1 pointer-events-none text-white"
                        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.65))" }}
                        aria-label={`${count} items`}
                      >
                        <Layers className="h-3.5 w-3.5" strokeWidth={2.5} />
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
          <div className="pointer-events-auto absolute top-0 left-0 right-0 z-50 flex items-center justify-end gap-2 pl-[max(env(safe-area-inset-left,0px),1rem)] pr-[max(env(safe-area-inset-right,0px),1rem)] pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3">
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
                src={avatarSignedUrl || undefined}
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
              <ProfileMediaLightbox
                group={lightbox.group}
                startIndex={lightbox.index}
                onIndexChange={(index) => setLightbox((prev) => prev ? { ...prev, index } : prev)}
                onClose={() => setLightbox(null)}
                onDownload={handleDownload}
              />

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

      {/* Caption Input Dialog (shared caption for the whole post) */}
      <Dialog open={showCaptionInput && pendingFiles.length > 0} onOpenChange={(open) => { if (!open && !isUploading) resetUploadState(); }}>
        <DialogContent className="inset-0 left-0 top-0 h-[100svh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-background p-0 sm:inset-0 sm:left-0 sm:top-0 sm:h-[100svh] sm:w-screen sm:max-w-none sm:translate-x-0 sm:translate-y-0 [&>button:last-child]:hidden">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]">
              <button type="button" onClick={resetUploadState} disabled={isUploading} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary" aria-label="Cancel upload">
                <X className="h-5 w-5" />
              </button>
              <div className="text-center">
                <h3 className="font-serif text-lg font-semibold">New profile post</h3>
                <p className="text-xs text-muted-foreground">{pendingFiles.length}/{MAX_GROUP_ITEMS} selected</p>
              </div>
              <Button size="sm" onClick={handleConfirmUpload} disabled={isUploading || pendingFiles.length === 0}>
                {isUploading ? "Posting..." : "Post"}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-height, 0px) + 1rem)' }}>
              {/* Caption first so it stays visible above keyboard on iOS */}
              <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Caption</span>
                  <span className={`text-xs ${uploadCaption.length >= 280 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {uploadCaption.length}/300
                  </span>
                </div>
                <Textarea
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value.slice(0, 300))}
                  placeholder="Write a caption (optional)..."
                  className="min-h-24 resize-none text-base"
                  rows={3}
                  maxLength={300}
                />
              </div>

              <div className="mx-auto mt-6 w-full max-w-xl">
                {pendingPreviews.length === 1 ? (
                  <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-muted">
                    {pendingPreviews[0].isVideo ? (
                      <video src={pendingPreviews[0].url} controls playsInline className="h-full w-full bg-muted object-cover" />
                    ) : (
                      <SquareImageThumbnail src={pendingPreviews[0].url} alt="Selected item 1" />
                    )}
                    <button type="button" onClick={() => removePendingItem(0)} disabled={isUploading} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm" aria-label="Remove selected item">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {pendingPreviews.map((p, i) => (
                      <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                        {p.isVideo ? (
                          <video src={p.url} playsInline muted className="h-full w-full bg-muted object-cover" />
                        ) : (
                          <SquareImageThumbnail src={p.url} alt={`Selected item ${i + 1}`} />
                        )}
                        <button type="button" onClick={() => removePendingItem(i)} disabled={isUploading} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm" aria-label={`Remove item ${i + 1}`}>
                          <X className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm">
                          {i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pendingFiles.length < MAX_GROUP_ITEMS && (
                  <div className="mt-4 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      onClick={handleAddMediaClick}
                      disabled={isUploading}
                      className="h-12"
                    >
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Add another photo ({pendingFiles.length}/{MAX_GROUP_ITEMS})
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Add up to {MAX_GROUP_ITEMS} photos.
                    </p>
                  </div>
                )}
              </div>
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
                      <SignedVideoThumbnail path={item.image_url} />
                    ) : (
                      <SquareSignedThumbnail path={item.image_url} bucket={PROFILE_BUCKET} transformImage={false} resolveAsBlob alt={`Item ${i + 1}`} />
                    )}
                  </div>
                ))}
              </div>
              <Textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value.slice(0, 300))}
                placeholder="Edit caption..."
                className="resize-none"
                rows={3}
                maxLength={300}
              />
              <p className={`text-xs text-right ${editCaption.length >= 280 ? 'text-destructive' : 'text-muted-foreground'}`}>{editCaption.length}/300</p>
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

      {pendingCrop && (
        <AvatarCropDialog
          open={!!pendingCrop}
          imageSrc={pendingCrop.src}
          onClose={() => setPendingCrop(null)}
          onCropComplete={handlePendingCropComplete}
          aspect={1}
          cropShape="rect"
          title="Crop Photo"
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
