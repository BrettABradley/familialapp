import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCircleContext } from "@/contexts/CircleContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, X, Trash2 } from "lucide-react";
import { VoiceRecorder } from "@/components/shared/VoiceRecorder";
import { validateFileSize, getFileMediaType } from "@/lib/mediaUtils";

interface CreatePostFormProps {
  onPostCreated: () => void;
}

export const CreatePostForm = ({ onPostCreated }: CreatePostFormProps) => {
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, profile } = useCircleContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  

  const [newPostContent, setNewPostContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 4) {
      toast({ title: "Too many files", description: "You can upload up to 4 files per post.", variant: "destructive" });
      return;
    }

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

  const handleVoiceRecording = (blob: Blob) => {
    if (selectedFiles.length >= 4) {
      toast({ title: "Too many files", description: "You can upload up to 4 files per post.", variant: "destructive" });
      return;
    }
    const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
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
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const { error } = await supabase.storage.from("post-media").upload(fileName, file);
      if (error) { continue; }
      const { data } = supabase.storage.from("post-media").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
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
      setNewPostContent("");
      setSelectedFiles([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      onPostCreated();
      toast({ title: "Posted!", description: "Your post has been shared with your circle." });

      // Silent background moderation — fire-and-forget
      if (newPost) {
        const postId = newPost.id;
        const textToCheck = newPostContent.trim() || undefined;
        const urlsToCheck = mediaUrls.length > 0 ? mediaUrls : undefined;

        (async () => {
          try {
            const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-content", {
              body: { text: textToCheck, imageUrls: urlsToCheck },
            });

            if (!modError && modResult && !modResult.allowed) {
              // Delete the post
              await supabase.from("posts").delete().eq("id", postId);
              // Cleanup media from storage
              for (const url of mediaUrls) {
                const path = url.split("/post-media/")[1];
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
          <img src={url} alt={`Preview ${index + 1}`} className="w-full aspect-square object-cover" />
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

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{profile?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-foreground">{profile?.display_name || "You"}</p>
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
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Textarea
          placeholder="What's happening with the family?"
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
          className="min-h-[100px] resize-none mb-4"
          maxLength={5000}
        />
        {previewUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {previewUrls.map((url, index) => renderPreview(url, index))}
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple onChange={handleFileSelect} className="hidden" />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isPosting}>
              <Paperclip className="w-4 h-4 mr-2" />Add Media
            </Button>
            <VoiceRecorder onRecordingComplete={handleVoiceRecording} />
            {(newPostContent.trim() || selectedFiles.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setNewPostContent("");
                  previewUrls.forEach(url => URL.revokeObjectURL(url));
                  setSelectedFiles([]);
                  setPreviewUrls([]);
                }}
                disabled={isPosting}
              >
                <Trash2 className="w-4 h-4 mr-2" />Discard
              </Button>
            )}
          </div>
          <Button onClick={handleCreatePost} disabled={(!newPostContent.trim() && selectedFiles.length === 0) || isPosting}>
            <Send className="w-4 h-4 mr-2" />{isPosting ? "Uploading..." : "Share"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
