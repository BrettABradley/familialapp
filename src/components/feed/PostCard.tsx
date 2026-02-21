import { useCircleContext } from "@/contexts/CircleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Send, Download, ChevronDown, ChevronUp } from "lucide-react";
import { LinkifiedText } from "@/components/shared/LinkifiedText";
import { getMediaType } from "@/lib/mediaUtils";
import type { Post } from "@/hooks/useFeedPosts";

interface PostCardProps {
  post: Post;
  isExpanded: boolean;
  commentInput: string;
  isSubmittingComment: boolean;
  hasUserReacted: boolean;
  onReaction: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onCommentInputChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string) => void;
  onDownloadImage: (url: string) => void;
}

const MediaItem = ({ url, index, onDownload }: { url: string; index: number; onDownload: (url: string) => void }) => {
  const mediaType = getMediaType(url);

  if (mediaType === 'video') {
    return (
      <div className="relative group rounded-lg overflow-hidden">
        <video controls className="w-full rounded-lg max-h-[400px]" preload="metadata">
          <source src={url} />
        </video>
      </div>
    );
  }

  if (mediaType === 'audio') {
    return (
      <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
        <audio controls className="w-full" preload="metadata">
          <source src={url} />
        </audio>
      </div>
    );
  }

  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden">
      <img src={url} alt={`Post image ${index + 1}`} className="w-full h-full object-cover" />
      <button
        onClick={() => onDownload(url)}
        className="absolute bottom-2 right-2 bg-background/80 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
        aria-label="Download image"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
};

export const PostCard = ({
  post,
  isExpanded,
  commentInput,
  isSubmittingComment,
  hasUserReacted,
  onReaction,
  onToggleComments,
  onCommentInputChange,
  onSubmitComment,
  onDownloadImage,
}: PostCardProps) => {
  const { profile } = useCircleContext();

  // Separate media by type for layout
  const imageUrls = post.media_urls?.filter(u => getMediaType(u) === 'image') || [];
  const otherMedia = post.media_urls?.filter(u => getMediaType(u) !== 'image') || [];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={post.profiles?.avatar_url || undefined} />
            <AvatarFallback>{post.profiles?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{post.profiles?.display_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {post.circles?.name} • {new Date(post.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {post.content && (
          <p className="text-foreground whitespace-pre-wrap mb-4">
            <LinkifiedText text={post.content} />
          </p>
        )}

        {/* Image grid */}
        {imageUrls.length > 0 && (
          <div className={`grid gap-2 mb-4 ${imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {imageUrls.map((url, index) => (
              <MediaItem key={index} url={url} index={index} onDownload={onDownloadImage} />
            ))}
          </div>
        )}

        {/* Video and audio items */}
        {otherMedia.length > 0 && (
          <div className="space-y-2 mb-4">
            {otherMedia.map((url, index) => (
              <MediaItem key={index} url={url} index={index} onDownload={onDownloadImage} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => onReaction(post.id)} className={hasUserReacted ? "text-destructive" : ""}>
            <Heart className={`w-4 h-4 mr-1 ${hasUserReacted ? "fill-current" : ""}`} />
            {post.reactions?.length || 0}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onToggleComments(post.id)}>
            <MessageCircle className="w-4 h-4 mr-1" />
            {post.comments?.length || 0}
            {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {post.comments?.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{comment.profiles?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-secondary rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{comment.profiles?.display_name || "Unknown"}</p>
                  <p className="text-sm text-foreground">{comment.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(comment.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{profile?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentInput}
                  onChange={(e) => onCommentInputChange(post.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmitComment(post.id); }
                  }}
                  className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button size="sm" onClick={() => onSubmitComment(post.id)} disabled={!commentInput?.trim() || isSubmittingComment} aria-label="Send comment">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
