import { useState } from "react";
import { Link } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Heart, MessageCircle, Send, Download, ChevronDown, ChevronUp, Trash2, Pencil, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { LinkifiedText } from "@/components/shared/LinkifiedText";
import { getMediaType } from "@/lib/mediaUtils";
import type { Post } from "@/hooks/useFeedPosts";

interface PostCardProps {
  post: Post;
  isExpanded: boolean;
  commentInput: string;
  isSubmittingComment: boolean;
  hasUserReacted: boolean;
  isOwnPost: boolean;
  onReaction: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onCommentInputChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string) => void;
  onDownloadImage: (url: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, newContent: string) => Promise<void>;
}

const MediaItem = ({ url, index, onDownload, onImageClick }: { url: string; index: number; onDownload: (url: string) => void; onImageClick?: (index: number) => void }) => {
  const mediaType = getMediaType(url);

  if (mediaType === 'video') {
    return (
      <div className="relative group rounded-lg overflow-hidden bg-secondary">
        <video
          controls
          className="w-full rounded-lg max-h-[400px]"
          preload="metadata"
          playsInline
          poster={`${url}#t=0.5`}
          onLoadedData={(e) => {
            const vid = e.currentTarget;
            vid.style.opacity = '1';
          }}
          style={{ opacity: 0, transition: 'opacity 0.3s ease-in' }}
        >
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
    <div className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer" onClick={() => onImageClick?.(index)}>
      <img src={url} alt={`Post image ${index + 1}`} className="w-full h-full object-cover" />
      <button
        onClick={(e) => { e.stopPropagation(); onDownload(url); }}
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
  isOwnPost,
  onReaction,
  onToggleComments,
  onCommentInputChange,
  onSubmitComment,
  onDownloadImage,
  onDelete,
  onEdit,
}: PostCardProps) => {
  const { profile } = useCircleContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleSaveEdit = async () => {
    if (!onEdit) return;
    setIsSavingEdit(true);
    await onEdit(post.id, editContent);
    setIsEditing(false);
    setIsSavingEdit(false);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content || "");
    setIsEditing(false);
  };

  // Separate media by type for layout
  const imageUrls = post.media_urls?.filter(u => getMediaType(u) === 'image') || [];
  const otherMedia = post.media_urls?.filter(u => getMediaType(u) !== 'image') || [];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.author_id}`}>
            <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={post.profiles?.avatar_url || undefined} />
              <AvatarFallback>{post.profiles?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1">
            <Link to={`/profile/${post.author_id}`} className="font-medium text-foreground hover:underline">
              {post.profiles?.display_name || "Unknown"}
            </Link>
            <p className="text-xs text-muted-foreground">
              {post.circles?.name} • {new Date(post.created_at).toLocaleDateString()}
            </p>
          </div>
          {isOwnPost && (
            <div className="flex items-center gap-1">
              {onEdit && !isEditing && (
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" onClick={() => { setEditContent(post.content || ""); setIsEditing(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete post?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. Your post and its comments will be permanently removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(post.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isEditing ? (
          <div className="mb-4 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={5000}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSavingEdit}>
                <X className="w-4 h-4 mr-1" />Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit}>
                <Check className="w-4 h-4 mr-1" />{isSavingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : post.content ? (
          <p className="text-foreground whitespace-pre-wrap mb-4">
            <LinkifiedText text={post.content} />
          </p>
        ) : null}

        {/* Image grid */}
        {imageUrls.length > 0 && (
          <div className={`grid gap-2 mb-4 ${imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {imageUrls.map((url, index) => (
              <MediaItem key={index} url={url} index={index} onDownload={onDownloadImage} onImageClick={(i) => setLightboxIndex(i)} />
            ))}
          </div>
        )}

        {/* Image Lightbox */}
        <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
          <DialogContent className="max-w-4xl p-2 bg-background/95">
            {lightboxIndex !== null && imageUrls[lightboxIndex] && (
              <div className="flex flex-col items-center">
                <img
                  src={imageUrls[lightboxIndex]}
                  alt={`Post image ${lightboxIndex + 1}`}
                  className="max-h-[80vh] w-auto object-contain rounded-lg"
                />
                {imageUrls.length > 1 && (
                  <div className="flex items-center gap-4 mt-3">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={lightboxIndex === 0}
                      onClick={() => setLightboxIndex((prev) => (prev !== null ? prev - 1 : null))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {lightboxIndex + 1} / {imageUrls.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={lightboxIndex === imageUrls.length - 1}
                      onClick={() => setLightboxIndex((prev) => (prev !== null ? prev + 1 : null))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Video and audio items */}
        {otherMedia.length > 0 && (
          <div className="space-y-2 mb-4">
            {otherMedia.map((url, index) => (
              <MediaItem key={index} url={url} index={index} onDownload={onDownloadImage} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-border">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={() => onReaction(post.id)} className={hasUserReacted ? "text-destructive" : ""}>
              <Heart className={`w-4 h-4 mr-1 ${hasUserReacted ? "fill-current" : ""}`} />
              {post.reactions?.length || 0}
            </Button>
            {(post.reactions?.length || 0) > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-foreground hover:underline ml-[-4px]">
                    {post.reactions!.length === 1
                      ? post.reactions![0].profiles?.display_name || "1 person"
                      : `${post.reactions!.length} people`}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Liked by</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {post.reactions!.map(r => (
                      <Link key={r.id} to={`/profile/${r.user_id}`} className="flex items-center gap-2 hover:bg-secondary rounded p-0.5 transition-colors">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={r.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">{r.profiles?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground truncate">{r.profiles?.display_name || "Unknown"}</span>
                      </Link>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
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
                <Link to={`/profile/${comment.author_id}`}>
                  <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{comment.profiles?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 bg-secondary rounded-lg px-3 py-2">
                  <Link to={`/profile/${comment.author_id}`} className="text-sm font-medium text-foreground hover:underline">
                    {comment.profiles?.display_name || "Unknown"}
                  </Link>
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
