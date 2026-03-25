import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PixelCampfire } from "./PixelCampfire";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampfireStory {
  id: string;
  content: string;
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [storyText, setStoryText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const hasUserSubmitted = stories.some(s => s.author_id === user?.id);

  useEffect(() => {
    if (open) {
      fetchStories();
    }
  }, [open, pinId]);

  const fetchStories = async () => {
    setIsLoading(true);
    // Use a manual join approach since campfire_stories isn't in generated types yet
    const { data, error } = await supabase
      .from("campfire_stories" as any)
      .select("id, content, author_id, created_at")
      .eq("fridge_pin_id", pinId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      // Fetch profiles for authors
      const authorIds = [...new Set((data as any[]).map((s: any) => s.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const enriched = (data as any[]).map((s: any) => ({
        ...s,
        profiles: profileMap.get(s.author_id) || null,
      }));
      setStories(enriched);
      if (enriched.length > 0 && currentIndex >= enriched.length) {
        setCurrentIndex(enriched.length - 1);
      }
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!storyText.trim() || !user) return;
    setIsSubmitting(true);

    const { error } = await supabase
      .from("campfire_stories" as any)
      .insert({
        fridge_pin_id: pinId,
        author_id: user.id,
        content: storyText.trim(),
      } as any);

    if (error) {
      if (error.message?.includes("unique") || error.code === "23505") {
        toast({ title: "Already shared", description: "You've already added your story to this campfire.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to share your story.", variant: "destructive" });
      }
    } else {
      setStoryText("");
      await fetchStories();
      toast({ title: "Story shared! 🔥", description: "Your story has been added to the campfire." });
    }
    setIsSubmitting(false);
  };

  const currentStory = stories[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">{pinTitle}</DialogTitle>

        {/* Campfire header area */}
        <div className="bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-800 px-6 pt-8 pb-4 flex flex-col items-center text-center">
          <PixelCampfire size="lg" />
          <h2 className="font-serif text-lg font-bold text-amber-100 mt-4">{pinTitle}</h2>
          {prompt && (
            <p className="text-sm text-amber-200/80 mt-1 italic">"{prompt}"</p>
          )}
          <p className="text-xs text-zinc-400 mt-2">
            {stories.length} {stories.length === 1 ? "story" : "stories"} shared
          </p>
        </div>

        {/* Stories area */}
        <div className="px-6 py-4 min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stories.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">No stories yet. Be the first to share!</p>
            </div>
          ) : currentStory ? (
            <div className="space-y-4">
              {/* Story card */}
              <div className="bg-secondary rounded-lg p-4 min-h-[100px]">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentStory.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {currentStory.profiles?.display_name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {currentStory.profiles?.display_name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(currentStory.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{currentStory.content}</p>
              </div>

              {/* Navigation */}
              {stories.length > 1 && (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(i => i - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {stories.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={currentIndex === stories.length - 1}
                    onClick={() => setCurrentIndex(i => i + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {/* Submit story input */}
          {!hasUserSubmitted && user && (
            <div className={cn("space-y-3", stories.length > 0 && "mt-4 pt-4 border-t border-border")}>
              <p className="text-sm font-medium text-foreground">Share your story</p>
              <Textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="Share your story around the fire..."
                maxLength={500}
                className="min-h-[80px] resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{storyText.length}/500</span>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!storyText.trim() || isSubmitting}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {isSubmitting ? "Sharing..." : "Share"}
                </Button>
              </div>
            </div>
          )}

          {hasUserSubmitted && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              ✓ You've shared your story
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
