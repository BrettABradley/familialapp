import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PixelCampfire } from "./PixelCampfire";
import { VoiceRecorder } from "@/components/shared/VoiceRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Send, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampfireStory {
  id: string;
  content: string | null;
  audio_url: string | null;
  author_id: string;
  created_at: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface CampfireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinId: string;
  pinTitle: string;
  prompt: string | null;
}

export function CampfireDialog({ open, onOpenChange, pinId, pinTitle, prompt }: CampfireDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stories, setStories] = useState<CampfireStory[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [storyText, setStoryText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const avatarRowRef = useRef<HTMLDivElement>(null);

  const hasUserSubmitted = stories.some(s => s.author_id === user?.id);
  const currentStory = stories.find(s => s.author_id === selectedAuthor) || null;

  useEffect(() => {
    if (open) {
      fetchStories();
      setSelectedAuthor(null);
    }
  }, [open, pinId]);

  // Cleanup audio preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  const fetchStories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("campfire_stories" as any)
      .select("id, content, audio_url, author_id, created_at")
      .eq("fridge_pin_id", pinId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      const authorIds = [...new Set((data as any[]).map((s: any) => s.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const enriched: CampfireStory[] = (data as any[]).map((s: any) => ({
        ...s,
        profiles: profileMap.get(s.author_id) || null,
      }));
      setStories(enriched);
    }
    setIsLoading(false);
  };

  const handleAvatarTap = (authorId: string) => {
    setSelectedAuthor(prev => prev === authorId ? null : authorId);
  };

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
    setAudioPreviewUrl(URL.createObjectURL(blob));
  };

  const handleRemoveAudio = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
  };

  const handleSubmit = async () => {
    if ((!storyText.trim() && !audioBlob) || !user) return;
    setIsSubmitting(true);

    let audioUrl: string | null = null;

    // Upload audio if present
    if (audioBlob) {
      const fileName = `campfire/${pinId}/${user.id}_${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(fileName, audioBlob, { contentType: "audio/webm" });

      if (uploadError) {
        toast({ title: "Upload failed", description: "Could not upload voice memo.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("post-media").getPublicUrl(fileName);
      audioUrl = urlData.publicUrl;
    }

    const { error } = await supabase
      .from("campfire_stories" as any)
      .insert({
        fridge_pin_id: pinId,
        author_id: user.id,
        content: storyText.trim() || null,
        audio_url: audioUrl,
      } as any);

    if (error) {
      if (error.message?.includes("unique") || error.code === "23505") {
        toast({ title: "Already shared", description: "You've already added your story to this campfire.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to share your story.", variant: "destructive" });
      }
    } else {
      setStoryText("");
      handleRemoveAudio();
      await fetchStories();
      setSelectedAuthor(user.id);
      toast({ title: "Story shared! 🔥", description: "Your story has been added to the campfire." });
    }
    setIsSubmitting(false);
  };

  const canSubmit = storyText.trim().length > 0 || audioBlob !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden [&>button:last-child]:hidden [&>button]:z-50 [&>button]:text-white [&>button]:hover:text-white/80">
        <DialogTitle className="sr-only">{pinTitle}</DialogTitle>

        {/* Campsite hero */}
        <div className="relative bg-gradient-to-b from-[#0a0a2e] via-[#121240] to-[#1a1a3e] px-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] pb-4 flex flex-col items-center text-center overflow-hidden">
          {/* Custom mobile close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-[max(env(safe-area-inset-top,0px),0.75rem)] right-3 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 active:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Stars */}
          <div className="absolute top-3 left-[20%] w-1 h-1 bg-white/60 rounded-none animate-[campfire-spark_2s_ease-in-out_infinite]" />
          <div className="absolute top-5 right-[25%] w-1 h-1 bg-white/40 rounded-none animate-[campfire-spark_3s_ease-in-out_infinite_1s]" />
          <div className="absolute top-2 right-[15%] w-0.5 h-0.5 bg-white/50 rounded-none" />

          <PixelCampfire size="lg" storyCount={stories.length} />

          {prompt && (
            <p className="text-sm text-amber-200/90 mt-3 italic max-w-[280px]">"{prompt}"</p>
          )}

          {/* Scrollable avatar row */}
          {stories.length > 0 && (
            <div
              ref={avatarRowRef}
              className="flex items-start gap-2 mt-4 w-full overflow-x-auto pb-2 px-2 scrollbar-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="flex items-start gap-2 mx-auto">
                {stories.map(s => (
                  <button
                    key={s.author_id}
                    onClick={() => handleAvatarTap(s.author_id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-1 rounded-lg transition-all shrink-0",
                      selectedAuthor === s.author_id
                        ? "ring-2 ring-amber-400 bg-amber-400/10"
                        : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <Avatar className="h-9 w-9 border-2 border-amber-800/50">
                      <AvatarImage src={s.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-amber-900/50 text-amber-100">
                        {s.profiles?.display_name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-amber-200/80 max-w-[50px] truncate">
                      {s.profiles?.display_name?.split(" ")[0] || "?"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat bubble — appears when an avatar is selected */}
          {currentStory && selectedAuthor && (
            <div className="relative w-full max-w-[300px] mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-amber-900/60" />
              <div className="bg-amber-900/60 backdrop-blur-sm border border-amber-700/30 rounded-lg p-3 text-left">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-xs font-medium text-amber-100">
                    {currentStory.profiles?.display_name || "Unknown"}
                  </p>
                  <p className="text-[10px] text-amber-200/50">
                    {new Date(currentStory.created_at).toLocaleDateString()}
                  </p>
                </div>
                {currentStory.content && (
                  <p className="text-sm text-amber-50/90 whitespace-pre-wrap leading-relaxed">{currentStory.content}</p>
                )}
                {currentStory.audio_url && (
                  <audio
                    controls
                    src={currentStory.audio_url}
                    className="w-full mt-2 h-8"
                    preload="metadata"
                  />
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-zinc-400 mt-2">
            {stories.length} {stories.length === 1 ? "story" : "stories"} shared
          </p>
        </div>

        {/* Bottom area */}
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-16">
              <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasUserSubmitted && user ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Share your story</p>
              <Textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="Share your story around the fire..."
                maxLength={500}
                className="min-h-[80px] resize-none"
              />

              {/* Audio preview */}
              {audioPreviewUrl && (
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/50 p-2">
                  <audio controls src={audioPreviewUrl} className="flex-1 h-8" preload="metadata" />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={handleRemoveAudio}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{storyText.length}/500</span>
                  {!audioBlob && <VoiceRecorder onRecordingComplete={handleRecordingComplete} maxDuration={120} />}
                </div>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {isSubmitting ? "Sharing..." : "Share"}
                </Button>
              </div>
            </div>
          ) : stories.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center">No stories yet. Be the first to share!</p>
          ) : hasUserSubmitted ? (
            <p className="text-xs text-muted-foreground text-center">
              ✓ You've shared your story
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
