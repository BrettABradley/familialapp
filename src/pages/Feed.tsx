import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Loader2 } from "lucide-react";
import { useFeedPosts } from "@/hooks/useFeedPosts";
import { CreatePostForm } from "@/components/feed/CreatePostForm";
import { PostCard } from "@/components/feed/PostCard";

const Feed = () => {
  const { circles, isLoading: contextLoading } = useCircleContext();
  const [searchParams] = useSearchParams();
  const highlightPostId = searchParams.get("post");
  const scrolledRef = useRef(false);
  const {
    posts,
    isLoadingPosts,
    hasMore,
    expandedComments,
    commentInputs,
    setCommentInputs,
    isSubmittingComment,
    fetchPosts,
    handleReaction,
    handleSubmitComment,
    toggleComments,
    handleDownloadImage,
    handleDeletePost,
    handleEditPost,
    handleDeleteComment,
    hasUserReacted,
    user,
  } = useFeedPosts();

  useEffect(() => {
    if (highlightPostId && !isLoadingPosts && posts.length > 0 && !scrolledRef.current) {
      scrolledRef.current = true;
      const el = document.getElementById(`post-${highlightPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Auto-expand comments for the linked post
        if (!expandedComments.has(highlightPostId)) {
          toggleComments(highlightPostId);
        }
      }
    }
  }, [highlightPostId, isLoadingPosts, posts]);

  if (contextLoading || isLoadingPosts) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full mb-4" />
            <div className="flex justify-between">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>
        {[1, 2, 3].map(i => (
          <Card key={i} className="mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full mb-4" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      {circles.length > 0 ? (
        <CreatePostForm onPostCreated={() => fetchPosts(true)} />
      ) : (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Create Your First Circle</h2>
            <p className="text-muted-foreground mb-6">Circles are private spaces for your family or close friends.</p>
            <Link to="/circles">
              <Button><Plus className="w-4 h-4 mr-2" />Create a Circle</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {posts.length === 0 && circles.length > 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No posts yet. Be the first to share something with your circle!</p>
            </CardContent>
          </Card>
        )}

        {posts.map((post) => (
          <div key={post.id} id={`post-${post.id}`}>
            <PostCard
              post={post}
              isExpanded={expandedComments.has(post.id)}
              commentInput={commentInputs[post.id] || ""}
              isSubmittingComment={isSubmittingComment === post.id}
              hasUserReacted={hasUserReacted(post) || false}
              isOwnPost={post.author_id === user?.id}
              currentUserId={user?.id}
              onReaction={handleReaction}
              onToggleComments={toggleComments}
              onCommentInputChange={(postId, value) => setCommentInputs(prev => ({ ...prev, [postId]: value }))}
              onSubmitComment={handleSubmitComment}
              onDownloadImage={handleDownloadImage}
              onDelete={handleDeletePost}
              onEdit={handleEditPost}
              onDeleteComment={handleDeleteComment}
            />
          </div>
        ))}

        {hasMore && (
          <div className="text-center py-4">
            <Button variant="outline" onClick={() => fetchPosts(false)}>
              <Loader2 className="w-4 h-4 mr-2" />
              Load More
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default Feed;
