import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Heart, MessageCircle, Send, Download, ChevronDown, ChevronUp, Trash2, Pencil, Check, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { LinkifiedText } from "@/components/shared/LinkifiedText";
import { LinkPreviewCard } from "@/components/feed/LinkPreviewCard";
import { getMediaType } from "@/lib/mediaUtils";
import type { Post } from "@/hooks/useFeedPosts";

interface CircleMemberRef {
  user_id: string;
  display_name: string | null;
}

interface PostCardProps {
  post: Post;
  isExpanded: boolean;
  commentInput: string;
  isSubmittingComment: boolean;
  hasUserReacted: boolean;
  isOwnPost: boolean;
  isCircleAdmin?: boolean;
  currentUserId?: string;
  circleMembers?: CircleMemberRef[];
  onReaction: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onCommentInputChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, parentCommentId?: string) => void;
  onDownloadImage: (url: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, newContent: string) => Promise<void>;
  onDeleteComment?: (postId: string, commentId: string) => void;
}

const VideoPlayer = ({ url }: { url: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("16/9");

  useEffect(() => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const handleSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL("image/jpeg", 0.7));
        }
      } catch {
        // CORS or other error – fall back to no poster
      }
      video.removeEventListener("seeked", handleSeeked);
      video.src = "";
      video.load();
    };

    video.addEventListener("loadeddata", () => {
      video.currentTime = 0.1;
    });
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", () => {});
    video.load();

    return () => {
      video.removeEventListener("seeked", handleSeeked);
      video.src = "";
    };
  }, [url]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const w = videoRef.current.videoWidth;
      const h = videoRef.current.videoHeight;
      if (w && h) {
        setAspectRatio(`${w}/${h}`);
      }
    }
    setShowPlaceholder(false);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden bg-secondary">
      {showPlaceholder && (
        <div className="w-full rounded-lg bg-muted animate-pulse absolute inset-0 z-10" style={{ aspectRatio }} />
      )}
      <video
        ref={videoRef}
        controls
        className="w-full rounded-lg object-contain max-h-[600px]"
        style={{ aspectRatio }}
        preload="metadata"
        playsInline
        {...(thumbnail ? { poster: thumbnail } : {})}
        onLoadedMetadata={handleLoadedMetadata}
      >
        <source src={url} type="video/mp4" />
        <source src={url} type="video/quicktime" />
        <source src={url} />
      </video>
    </div>
  );
};

const VideoThumbnail = ({ url, onClick }: { url: string; onClick: () => void }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const handleSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL("image/jpeg", 0.7));
        }
      } catch {}
      video.removeEventListener("seeked", handleSeeked);
      video.src = "";
      video.load();
    };

    video.addEventListener("loadeddata", () => { video.currentTime = 0.1; });
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", () => {});
    video.load();

    return () => { video.removeEventListener("seeked", handleSeeked); video.src = ""; };
  }, [url]);

  return (
    <div
      className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer bg-secondary"
      onClick={onClick}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-muted animate-pulse" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-foreground/10 group-hover:bg-foreground/20 transition-colors">
        <div className="bg-background/80 rounded-full p-3">
          <Play className="w-6 h-6 text-foreground fill-current" />
        </div>
      </div>
    </div>
  );
};

const MediaItem = ({ url, index, onDownload, onImageClick, onVideoClick }: { url: string; index: number; onDownload: (url: string) => void; onImageClick?: (index: number) => void; onVideoClick?: (url: string) => void }) => {
  const mediaType = getMediaType(url);

  if (mediaType === 'video') {
    return <VideoThumbnail url={url} onClick={() => onVideoClick?.(url)} />;
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
  isCircleAdmin: isAdmin = false,
  currentUserId,
  circleMembers = [],
  onReaction,
  onToggleComments,
  onCommentInputChange,
  onSubmitComment,
  onDownloadImage,
  onDelete,
  onEdit,
  onDeleteComment,
}: PostCardProps) => {
  const canDelete = isOwnPost || isAdmin;
  const { profile } = useCircleContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

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
  const visualMedia = post.media_urls?.filter(u => getMediaType(u) === 'image' || getMediaType(u) === 'video') || [];
  const audioMedia = post.media_urls?.filter(u => getMediaType(u) === 'audio') || [];
  const imageUrls = post.media_urls?.filter(u => getMediaType(u) === 'image') || [];

  // Extract first URL from post content for link preview
  const firstUrl = post.content?.match(/(https?:\/\/[^\s]+)/)?.[0] || null;

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
          {(isOwnPost || canDelete) && (
            <div className="flex items-center gap-1">
              {isOwnPost && onEdit && !isEditing && (
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" onClick={() => { setEditContent(post.content || ""); setIsEditing(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete post?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. This post and its comments will be permanently removed.</AlertDialogDescription>
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
            <LinkifiedText text={post.content} members={circleMembers} />
          </p>
        ) : null}

        {/* Link Preview */}
        {firstUrl && <LinkPreviewCard url={firstUrl} />}

        {/* Audio items */}
        {audioMedia.length > 0 && (
          <div className="space-y-2 mb-4">
            {audioMedia.map((url, index) => (
              <MediaItem key={index} url={url} index={index} onDownload={onDownloadImage} />
            ))}
          </div>
        )}

        {/* Visual media grid (images + video thumbnails together) */}
        {visualMedia.length > 0 && (
          <div className={`grid gap-2 mb-4 ${visualMedia.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {visualMedia.map((url, index) => (
              <MediaItem
                key={index}
                url={url}
                index={index}
                onDownload={onDownloadImage}
                onImageClick={() => setLightboxIndex(index)}
                onVideoClick={() => setLightboxIndex(index)}
              />
            ))}
          </div>
        )}

        {/* Unified Media Lightbox — fullscreen on mobile, centered modal on desktop */}
        <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
          <DialogContent className="max-w-none sm:max-w-[95vw] sm:w-fit px-0 py-0 p-0 border-0 bg-black/95 sm:bg-background/95 sm:p-2 sm:border sm:rounded-lg [&>button:last-child]:hidden inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] rounded-none sm:rounded-lg flex flex-col items-center justify-center">
            {lightboxIndex !== null && visualMedia[lightboxIndex] && (
              <>
                {/* Top control bar — safe area aware on mobile */}
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-end gap-2 px-4 pt-[max(env(safe-area-inset-top,0px),3.25rem)] sm:pt-3 sm:pr-4">
                  {getMediaType(visualMedia[lightboxIndex]) === 'image' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60"
                      onClick={() => onDownloadImage(visualMedia[lightboxIndex])}
                      aria-label="Download"
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 backdrop-blur-sm text-white hover:text-white hover:bg-black/60"
                    onClick={() => setLightboxIndex(null)}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Centered media */}
                {getMediaType(visualMedia[lightboxIndex]) === 'video' ? (
                  <video
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto object-contain select-none"
                    onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; }}
                    onTouchEnd={(e) => {
                      const deltaX = touchStartX.current - e.changedTouches[0].clientX;
                      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
                      if (deltaY > 80 && Math.abs(deltaX) < 50) { setLightboxIndex(null); return; }
                      if (deltaX > 50 && lightboxIndex < visualMedia.length - 1) setLightboxIndex(lightboxIndex + 1);
                      else if (deltaX < -50 && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
                    }}
                  >
                    <source src={visualMedia[lightboxIndex]} type="video/mp4" />
                    <source src={visualMedia[lightboxIndex]} type="video/quicktime" />
                    <source src={visualMedia[lightboxIndex]} />
                  </video>
                ) : (
                  <img
                    src={visualMedia[lightboxIndex]}
                    alt={`Post media ${lightboxIndex + 1}`}
                    className="max-h-[80vh] sm:max-h-[90vh] max-w-full sm:max-w-[90vw] w-auto object-contain select-none"
                    onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; }}
                    onTouchEnd={(e) => {
                      const deltaX = touchStartX.current - e.changedTouches[0].clientX;
                      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
                      if (deltaY > 80 && Math.abs(deltaX) < 50) { setLightboxIndex(null); return; }
                      if (deltaX > 50 && lightboxIndex < visualMedia.length - 1) setLightboxIndex(lightboxIndex + 1);
                      else if (deltaX < -50 && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
                    }}
                  />
                )}

                {/* Left/right navigation arrows */}
                {visualMedia.length > 1 && (
                  <>
                    {lightboxIndex > 0 && (
                      <button
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                        onClick={() => setLightboxIndex((prev) => (prev !== null ? prev - 1 : null))}
                        aria-label="Previous"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                    )}
                    {lightboxIndex < visualMedia.length - 1 && (
                      <button
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                        onClick={() => setLightboxIndex((prev) => (prev !== null ? prev + 1 : null))}
                        aria-label="Next"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    )}
                    {/* Media counter */}
                    <div className="absolute bottom-6 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full" style={{ marginBottom: "max(env(safe-area-inset-bottom, 0px), 0px)" }}>
                      {lightboxIndex + 1} / {visualMedia.length}
                    </div>
                  </>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

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

        {isExpanded && (() => {
          const topLevelComments = post.comments?.filter(c => !(c as any).parent_comment_id) || [];
          const allReplies = post.comments?.filter(c => (c as any).parent_comment_id) || [];
          const getReplies = (commentId: string) => allReplies.filter(r => (r as any).parent_comment_id === commentId);

          const renderComment = (comment: typeof topLevelComments[0], isReply = false) => (
            <div key={comment.id} className={`flex gap-3 ${isReply ? "ml-10" : ""}`}>
              <Link to={`/profile/${comment.author_id}`}>
                <Avatar className={`${isReply ? "h-6 w-6" : "h-8 w-8"} cursor-pointer hover:opacity-80 transition-opacity`}>
                  <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{comment.profiles?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 bg-secondary rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <Link to={`/profile/${comment.author_id}`} className="text-sm font-medium text-foreground hover:underline">
                    {comment.profiles?.display_name || "Unknown"}
                  </Link>
                  {(currentUserId === comment.author_id || isAdmin) && onDeleteComment && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to delete this comment? Any replies will also be removed.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteComment(post.id, comment.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <p className="text-sm text-foreground"><LinkifiedText text={comment.content} members={circleMembers} /></p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</p>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>
          );

          // Find the top-level parent for a reply (to nest reply input under the right thread)
          const getTopParent = (commentId: string): string => {
            const comment = post.comments?.find(c => c.id === commentId);
            if (!comment || !(comment as any).parent_comment_id) return commentId;
            return getTopParent((comment as any).parent_comment_id);
          };

          const renderReplyInput = (parentCommentId: string) => {
            const parentComment = post.comments?.find(c => c.id === parentCommentId);
            return (
              <div className="flex gap-2 ml-10">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{profile?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder={`Reply to ${parentComment?.profiles?.display_name || "Unknown"}...`}
                    value={commentInput}
                    onChange={(e) => onCommentInputChange(post.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmitComment(post.id, parentCommentId); setReplyingTo(null); }
                    }}
                    className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  <Button size="sm" onClick={() => { onSubmitComment(post.id, parentCommentId); setReplyingTo(null); }} disabled={!commentInput?.trim() || isSubmittingComment} aria-label="Send reply">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          };

          return (
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              {topLevelComments.map((comment) => {
                const commentReplies = getReplies(comment.id);
                // Also get nested replies (replies to replies, which have parent pointing to a reply)
                const allNestedReplies: typeof topLevelComments = [];
                const collectReplies = (parentId: string) => {
                  const children = allReplies.filter(r => (r as any).parent_comment_id === parentId);
                  children.forEach(child => {
                    allNestedReplies.push(child);
                    collectReplies(child.id);
                  });
                };
                collectReplies(comment.id);

                return (
                  <div key={comment.id} className="space-y-2">
                    {renderComment(comment)}
                    {allNestedReplies.map(reply => renderComment(reply, true))}
                    {replyingTo && (replyingTo === comment.id || allNestedReplies.some(r => r.id === replyingTo)) && renderReplyInput(replyingTo)}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{profile?.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={replyingTo ? "" : commentInput}
                    onChange={(e) => { if (!replyingTo) onCommentInputChange(post.id, e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !replyingTo) { e.preventDefault(); onSubmitComment(post.id); }
                    }}
                    className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button size="sm" onClick={() => onSubmitComment(post.id)} disabled={!commentInput?.trim() || isSubmittingComment || !!replyingTo} aria-label="Send comment">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
};
