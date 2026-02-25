import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCircleContext } from "@/contexts/CircleContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Circle {
  id: string;
  name: string;
  owner_id: string;
}

export interface Comment {
  id: string;
  content: string;
  author_id: string;
  created_at: string;
  parent_comment_id?: string | null;
  profiles?: Profile;
}

export interface Reaction {
  id: string;
  user_id: string;
  reaction_type: string;
  profiles?: Profile;
}

export interface Post {
  id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  author_id: string;
  circle_id: string;
  profiles?: Profile;
  circles?: Circle;
  reactions?: Reaction[];
  comments?: Comment[];
}

const PAGE_SIZE = 50;

export const useFeedPosts = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, profile, isLoading: contextLoading } = useCircleContext();
  const { toast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCircle) {
      fetchPosts(true);
    } else if (!contextLoading) {
      setIsLoadingPosts(false);
    }
  }, [selectedCircle, contextLoading]);

  const fetchPosts = async (reset = false) => {
    if (!selectedCircle) return;

    if (reset) setIsLoadingPosts(true);
    const circleIds = [selectedCircle];
    const cursor = !reset && posts.length > 0 ? posts[posts.length - 1].created_at : null;

    let query = supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_profiles_fkey(id, user_id, display_name, avatar_url),
        circles!posts_circle_id_fkey(id, name, owner_id),
        reactions(id, user_id, reaction_type, profiles:profiles!reactions_user_id_profiles_fkey(id, user_id, display_name, avatar_url)),
        comments(id, content, author_id, created_at, parent_comment_id, profiles!comments_author_id_profiles_fkey(id, user_id, display_name, avatar_url))
      `)
      .in("circle_id", circleIds)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (!error && data) {
      const typed = data as unknown as Post[];
      setPosts(prev => reset ? typed : [...prev, ...typed]);
      setHasMore(typed.length === PAGE_SIZE);
    }
    setIsLoadingPosts(false);
  };

  const handleReaction = async (postId: string) => {
    if (!user) return;

    const post = posts.find(p => p.id === postId);
    const existingReaction = post?.reactions?.find(r => r.user_id === user.id);

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      if (existingReaction) {
        return { ...p, reactions: p.reactions?.filter(r => r.id !== existingReaction.id) };
      } else {
        return { ...p, reactions: [...(p.reactions || []), { id: crypto.randomUUID(), user_id: user.id, reaction_type: "heart" }] };
      }
    }));

    try {
      if (existingReaction) {
        const { error } = await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("reactions").insert({
          post_id: postId,
          user_id: user.id,
          reaction_type: "heart",
        }).select("id").single();
        if (error) throw error;
        // Update with real ID from DB
        if (data) {
          setPosts(prev => prev.map(p => {
            if (p.id !== postId) return p;
            return { ...p, reactions: p.reactions?.map(r => r.user_id === user.id && r.id !== data.id ? { ...r, id: data.id } : r) };
          }));
        }
      }
    } catch {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        if (existingReaction) {
          return { ...p, reactions: [...(p.reactions || []), existingReaction] };
        } else {
          return { ...p, reactions: p.reactions?.filter(r => r.user_id !== user.id) };
        }
      }));
      toast({ title: "Error", description: "Failed to update reaction.", variant: "destructive" });
    }
  };

  const handleSubmitComment = async (postId: string, parentCommentId?: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content || !user) return;

    setIsSubmittingComment(postId);

    const tempId = crypto.randomUUID();
    const newComment: Comment = {
      id: tempId,
      content,
      author_id: user.id,
      created_at: new Date().toISOString(),
      parent_comment_id: parentCommentId || null,
      profiles: profile ? { id: profile.id, user_id: profile.user_id, display_name: profile.display_name, avatar_url: profile.avatar_url } : undefined,
    };

    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...(p.comments || []), newComment] };
    }));

    const insertData: any = { post_id: postId, author_id: user.id, content };
    if (parentCommentId) insertData.parent_comment_id = parentCommentId;

    const { error } = await supabase
      .from("comments")
      .insert(insertData);

    if (error) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return { ...p, comments: (p.comments || []).filter(c => c.id !== tempId) };
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: content }));
      toast({ title: "Error", description: "Failed to add comment.", variant: "destructive" });
    } else {
      // Create notification for post author (comment) or parent comment author (reply)
      const post = posts.find(p => p.id === postId);
      const displayName = profile?.display_name || "Someone";

      if (parentCommentId) {
        // Reply notification — notify the parent comment author
        const parentComment = post?.comments?.find(c => c.id === parentCommentId);
        if (parentComment && parentComment.author_id !== user.id) {
          supabase.from("notifications").insert({
            user_id: parentComment.author_id,
            type: "comment_reply",
            title: "Reply to your comment",
            message: `${displayName} replied: "${content.slice(0, 100)}"`,
            related_post_id: postId,
            related_user_id: user.id,
            related_circle_id: post?.circle_id || null,
            link: `/feed?post=${postId}`,
          }).then();
        }
      }

      // Always notify the post author about comments (unless it's their own)
      if (post && post.author_id !== user.id) {
        supabase.from("notifications").insert({
          user_id: post.author_id,
          type: "comment",
          title: parentCommentId ? "New reply on your post" : "New comment on your post",
          message: `${displayName}: "${content.slice(0, 100)}"`,
          related_post_id: postId,
          related_user_id: user.id,
          related_circle_id: post.circle_id,
          link: `/feed?post=${postId}`,
        }).then();
      }
    }

    setIsSubmittingComment(null);
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) newSet.delete(postId);
      else newSet.add(postId);
      return newSet;
    });
  };

  const handleDownloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `familial-photo-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      toast({ title: "Downloaded!", description: "Photo saved to your device." });
    } catch {
      toast({ title: "Download failed", description: "Could not download the image.", variant: "destructive" });
    }
  };

  const handleDeletePost = async (postId: string) => {
    const postToDelete = posts.find(p => p.id === postId);
    if (!postToDelete || !user) return;

    setPosts(prev => prev.filter(p => p.id !== postId));

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      if (postToDelete) setPosts(prev => [...prev, postToDelete].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      toast({ title: "Error", description: "Failed to delete post.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Post removed." });
    }
  };

  const handleEditPost = async (postId: string, newContent: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    if (!post || post.author_id !== user.id) return;

    const oldContent = post.content;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent || null } : p));

    const { error } = await supabase.from("posts").update({ content: newContent || null }).eq("id", postId);
    if (error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: oldContent } : p));
      toast({ title: "Error", description: "Failed to edit post.", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Post edited successfully." });
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    const comment = post?.comments?.find(c => c.id === commentId);
    if (!comment) return;

    // Optimistic: remove the comment and its replies
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const idsToRemove = new Set<string>([commentId]);
      // Also remove replies to this comment
      const collectChildren = (parentId: string) => {
        p.comments?.forEach(c => {
          if (c.parent_comment_id === parentId) {
            idsToRemove.add(c.id);
            collectChildren(c.id);
          }
        });
      };
      collectChildren(commentId);
      return { ...p, comments: (p.comments || []).filter(c => !idsToRemove.has(c.id)) };
    }));

    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      // Revert
      fetchPosts(true);
      toast({ title: "Error", description: "Failed to delete comment.", variant: "destructive" });
    }
  };

  const hasUserReacted = (post: Post) => post.reactions?.some(r => r.user_id === user?.id);

  return {
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
  };
};
