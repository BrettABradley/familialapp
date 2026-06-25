import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCircleContext } from "@/contexts/CircleContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, X, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ToastAction } from "@/components/ui/toast";
import { VoiceRecorder } from "@/components/shared/VoiceRecorder";
import { MentionInput, EVERYONE_SENTINEL } from "@/components/shared/MentionInput";
import { useCircleMembers } from "@/hooks/useCircleMembers";
import { validateFileSize, getFileMediaType, getMediaType } from "@/lib/mediaUtils";
import { blobToVoiceNoteFile } from "@/lib/voiceNoteFile";
import { convertHeicFiles } from "@/lib/heicConverter";
import { SquareImageThumbnail } from "@/components/shared/SquareMediaThumbnail";
import { getPostMediaUrls } from "@/lib/postMediaUrl";

interface CreatePostFormProps {
  onPostCreated: () => void;
}

export const CreatePostForm = ({ onPostCreated }: CreatePostFormProps) => {
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, profile } = useCircleContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);


  const circleMembers = useCircleMembers();

  const [newPostContent, setNewPostContent] = useState(() => {
    if (selectedCircle) {
      return sessionStorage.getItem(`draft-feed-${selectedCircle}`) || "";
    }
    return "";
  });

  // Persist feed draft to sessionStorage
  const updatePostContent = (val: string) => {
    setNewPostContent(val);
    if (selectedCircle) {
      if (val.trim()) sessionStorage.setItem(`draft-feed-${selectedCircle}`, val);
      else sessionStorage.removeItem(`draft-feed-${selectedCircle}`);
    }
  };

  // Restore draft when circle changes
  useEffect(() => {
    if (selectedCircle) {
      const saved = sessionStorage.getItem(`draft-feed-${selectedCircle}`);
      setNewPostContent(saved || "");
    }
  }, [selectedCircle]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set());


  const MAX_FILES = 4;

  const processFiles = async (incoming: File[]) => {
    let files = incoming;
    if (files.length + selectedFiles.length > MAX_FILES) {
      toast({ title: "Too many files", description: `You can upload up to ${MAX_FILES} files per post. For more images, try creating an Album!`, variant: "destructive", action: <ToastAction altText="Go to Albums" onClick={() => navigate("/albums")}>Go to Albums</ToastAction> });
      return;
    }

    files = await convertHeicFiles(files);

    for (const file of files) {
      const error = validateFileSize(file);
      if (error) {
        toast({ title: "File too large", description: error, variant: "destructive" });
        return;
      }
    }

    setSelectedFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Reset input so the same file can be picked again on Safari/iOS
    if (fileInputRef.current) fileInputRef.current.value = "";
    await processFiles(files);
  };

  const openMediaPicker = async () => {
    // Use the hidden <input accept="image/*,video/*"> on both web and native.
    // iOS/Android WebView surfaces a system picker that includes photos AND
    // videos — Capacitor's Camera plugin is photo-only, which is why video
    // posts from mobile weren't reaching the composer at all.
    fileInputRef.current?.click();
  };

  const handleVoiceRecording = async (blob: Blob) => {
    if (selectedFiles.length >= MAX_FILES) {
      toast({ title: "Too many files", description: `You can upload up to ${MAX_FILES} files per post.`, variant: "destructive" });
      return;
    }
    if (!blob || blob.size === 0) {
      toast({ title: "No audio recorded", description: "The recording was empty. Please try again.", variant: "destructive" });
      return;
    }
    // Normalize so extension, blob type and upload contentType agree —
    // otherwise iOS reports duration 0:00/0:00 and the audio won't play.
    const { file } = await blobToVoiceNoteFile(blob);
    setSelectedFiles(prev => [...prev, file]);
    setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!user || selectedFiles.length === 0) return [];
    const uploadedUrls: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress(Math.round(((i) / selectedFiles.length) * 100));
      // Audio files: trust the file's own type/extension (already normalized
      // by blobToVoiceNoteFile). Don't force audio/mp4 — iOS raw-AAC bytes
      // would become undecodable.
      const isAudio = (file.type || "").startsWith("audio") || /voice-note[-_]/i.test(file.name);
      const nameExt = file.name.split(".").pop()?.toLowerCase();
      const fileExt = isAudio ? (nameExt || "m4a") : (nameExt || "bin");
      // Preserve `voice-note-` prefix in the storage path so the display-side
      // heuristic in getMediaType() always classifies it as audio — otherwise
      // a `.webm` voice note (Chrome) renders as a black <video> element.
      const baseName = isAudio
        ? `voice-note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileName = `${user.id}/${baseName}.${fileExt}`;
      const { error } = await supabase.storage.from("post-media").upload(fileName, file, {
        contentType: file.type || undefined,
      });
      if (error) { continue; }
      // Store the storage path; render sites resolve to signed URLs on demand.
      uploadedUrls.push(fileName);
    }
    setUploadProgress(100);
    return uploadedUrls;
  };

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && selectedFiles.length === 0) || !selectedCircle || !user) return;
    setIsPosting(true);
    let mediaUrls: string[] = [];
    if (selectedFiles.length > 0) mediaUrls = await uploadFiles();

    const { data: newPost, error } = await supabase.from("posts").insert({
      content: newPostContent || null,
      author_id: user.id,
      circle_id: selectedCircle,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
    }).select("id").single();

    if (error) {
      toast({ title: "Error", description: "Failed to create post.", variant: "destructive" });
    } else {
      if (selectedCircle) sessionStorage.removeItem(`draft-feed-${selectedCircle}`);
      setNewPostContent("");
      setSelectedFiles([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      onPostCreated();
      toast({ title: "Posted!", description: "Your post has been shared with your circle." });

      // Fire @mention notifications
      if (newPost && mentionedUserIds.size > 0) {
        const hasEveryone = mentionedUserIds.has(EVERYONE_SENTINEL);
        const realUserIds = Array.from(mentionedUserIds).filter((id) => id !== EVERYONE_SENTINEL);
        if (realUserIds.length > 0) {
          supabase.rpc("create_mention_notifications", {
            _mentioned_user_ids: realUserIds,
            _post_id: newPost.id,
            _circle_id: selectedCircle,
          }).then();
        }
        if (hasEveryone) {
          // Notifies every other circle member; the notifications-insert
          // trigger fans out push notifications (iOS, Android, web).
          supabase.rpc("create_everyone_mention_notifications" as any, {
            _post_id: newPost.id,
            _circle_id: selectedCircle,
          }).then();
        }
      }

      // Silent background moderation — fire-and-forget.
      // The Gemini classifier only handles text + images, so filter out
      // audio (voice notes) and video before signing — otherwise audio
      // posts get auto-deleted as "community-guideline violations".
      if (newPost) {
        const postId = newPost.id;
        const textToCheck = newPostContent.trim() || undefined;
        const imageOnlyPaths = mediaUrls.filter(
          (p) => p && getMediaType(p) === "image",
        );
        const signedUrlsToCheck = imageOnlyPaths.length > 0
          ? (await getPostMediaUrls(imageOnlyPaths)).filter(Boolean)
          : undefined;

        // Nothing for the moderator to look at? Skip the call entirely.
        if (textToCheck || (signedUrlsToCheck && signedUrlsToCheck.length > 0)) {
          (async () => {
            try {
              const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-content", {
                body: { text: textToCheck, imageUrls: signedUrlsToCheck },
              });

              if (!modError && modResult && !modResult.allowed) {
                // Delete the post
                await supabase.from("posts").delete().eq("id", postId);
                // Cleanup media from storage — values are bare paths now.
                for (const path of mediaUrls) {
                  if (path) await supabase.storage.from("post-media").remove([path]);
                }
                toast({
                  title: "Post removed",
                  description: "This post was removed because it may violate our community guidelines.",
                  variant: "destructive",
                });
                onPostCreated(); // Refresh feed to reflect removal
              }
            } catch (err) {
              console.error("Background moderation failed:", err);
              // Fail-open: post stays up
            }
          })();
        }
      }
    }
    setIsPosting(false);
    setUploadProgress(null);
  };

  const renderPreview = (url: string, index: number) => {
    const file = selectedFiles[index];
    const mediaType = getFileMediaType(file);

    return (
      <div key={index} className="relative rounded-lg overflow-hidden">
        {mediaType === 'video' ? (
          <video src={url} className="w-full aspect-video object-cover" muted />
        ) : mediaType === 'audio' ? (
          <div className="p-3 bg-secondary rounded-lg">
            <audio controls src={url} className="w-full" />
          </div>
        ) : (
          <div className="aspect-square w-full overflow-hidden">
            <SquareImageThumbnail src={url} alt={`Preview ${index + 1}`} />
          </div>
        )}
        <button
          onClick={() => removeFile(index)}
          className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-background transition-colors"
          aria-label={`Remove file ${index + 1}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const hasDraft = newPostContent.trim().length > 0 || selectedFiles.length > 0;

  const handleDiscard = () => {
    updatePostContent("");
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
  };

  const handleComposerFocus = () => {
    // Keep the Share button visible above the on-screen keyboard.
    // Run after the WebView finishes the resize: body shrink.
    window.setTimeout(() => {
      shareButtonRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }, 300);
  };

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{profile?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{profile?.display_name || "You"}</p>
            <Select value={selectedCircle} onValueChange={setSelectedCircle}>
              <SelectTrigger className="w-fit h-7 text-xs border-none p-0 text-muted-foreground">
                <SelectValue placeholder="Select circle" />
              </SelectTrigger>
              <SelectContent>
                {circles.map((circle) => (
                  <SelectItem key={circle.id} value={circle.id}>{circle.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasDraft && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs shrink-0"
              onClick={handleDiscard}
              disabled={isPosting}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />Discard
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-4">
          <MentionInput
            placeholder="What's happening with the family? Use @ to tag someone or @everyone to ping the whole circle"
            value={newPostContent}
            onChange={(val) => updatePostContent(val)}
            members={circleMembers}
            enableEveryone
            onMentionsChange={setMentionedUserIds}
            onFocus={handleComposerFocus}
            className="min-h-[100px] resize-none"
            maxLength={5000}
            disabled={isPosting}
          />
        </div>
        {previewUrls.length === 1 && (
          <div className="mb-4 mx-auto max-w-sm">{renderPreview(previewUrls[0], 0)}</div>
        )}
        {previewUrls.length > 1 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {previewUrls.map((url, index) => (
              <div key={index}>{renderPreview(url, index)}</div>
            ))}
            {selectedFiles.length < MAX_FILES && (
              <button
                type="button"
                onClick={openMediaPicker}
                disabled={isPosting}
                className="w-full aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-secondary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
                aria-label="Add more media"
              >
                <Paperclip className="w-6 h-6" />
                <span className="text-sm font-medium">Add more</span>
                <span className="text-xs">{selectedFiles.length}/{MAX_FILES}</span>
              </button>
            )}
          </div>
        )}
        {previewUrls.length >= 1 && selectedFiles.length < MAX_FILES && (
          <div className="mb-2 flex justify-center">
            <Button variant="outline" size="sm" onClick={openMediaPicker} disabled={isPosting}>
              <Paperclip className="w-4 h-4 mr-2" />Add more ({selectedFiles.length}/{MAX_FILES})
            </Button>
          </div>
        )}
        {uploadProgress !== null && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Uploading media...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2 scroll-mb-24">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
            <Button variant="ghost" size="sm" onClick={openMediaPicker} disabled={isPosting || selectedFiles.length >= MAX_FILES}>
              <Paperclip className="w-4 h-4 mr-2" />Add Media
            </Button>
            <VoiceRecorder onRecordingComplete={handleVoiceRecording} />
          </div>
          <Button ref={shareButtonRef} onClick={() => { import("@/lib/haptics").then(({ haptic }) => haptic.medium()); handleCreatePost(); }} disabled={(!newPostContent.trim() && selectedFiles.length === 0) || isPosting} className="scroll-mb-24">
            <Send className="w-4 h-4 mr-2" />{isPosting ? "Uploading..." : "Share"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
