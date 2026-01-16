import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Heart, MessageCircle, Send, LogOut, Users, Plus, Settings } from "lucide-react";
import logo from "@/assets/logo.png";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Circle {
  id: string;
  name: string;
  owner_id: string;
}

interface Post {
  id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  author_id: string;
  circle_id: string;
  profiles?: Profile;
  circles?: Circle;
  reactions?: { id: string; user_id: string; reaction_type: string }[];
  comments?: { id: string }[];
}

const Feed = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string>("");
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCircles();
    }
  }, [user]);

  useEffect(() => {
    if (circles.length > 0) {
      fetchPosts();
    }
  }, [circles]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (!error && data) {
      setProfile(data);
    }
  };

  const fetchCircles = async () => {
    if (!user) return;
    
    // Get circles where user is owner or member
    const { data: ownedCircles } = await supabase
      .from("circles")
      .select("*")
      .eq("owner_id", user.id);

    const { data: memberCircles } = await supabase
      .from("circle_memberships")
      .select("circle_id, circles(*)")
      .eq("user_id", user.id);

    const allCircles: Circle[] = [];
    
    if (ownedCircles) {
      allCircles.push(...ownedCircles);
    }
    
    if (memberCircles) {
      memberCircles.forEach((m) => {
        if (m.circles && !allCircles.find(c => c.id === (m.circles as Circle).id)) {
          allCircles.push(m.circles as Circle);
        }
      });
    }
    
    setCircles(allCircles);
    if (allCircles.length > 0 && !selectedCircle) {
      setSelectedCircle(allCircles[0].id);
    }
  };

  const fetchPosts = async () => {
    if (circles.length === 0) return;
    
    const circleIds = circles.map(c => c.id);
    
    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_fkey(id, user_id, display_name, avatar_url),
        circles!posts_circle_id_fkey(id, name),
        reactions(id, user_id, reaction_type),
        comments(id)
      `)
      .in("circle_id", circleIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setPosts(data as unknown as Post[]);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !selectedCircle || !user) return;
    
    setIsPosting(true);
    
    const { error } = await supabase
      .from("posts")
      .insert({
        content: newPostContent,
        author_id: user.id,
        circle_id: selectedCircle,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    } else {
      setNewPostContent("");
      fetchPosts();
      toast({
        title: "Posted!",
        description: "Your post has been shared with your circle.",
      });
    }
    
    setIsPosting(false);
  };

  const handleReaction = async (postId: string) => {
    if (!user) return;
    
    const post = posts.find(p => p.id === postId);
    const existingReaction = post?.reactions?.find(r => r.user_id === user.id);
    
    if (existingReaction) {
      await supabase.from("reactions").delete().eq("id", existingReaction.id);
    } else {
      await supabase.from("reactions").insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: "heart",
      });
    }
    
    fetchPosts();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const hasUserReacted = (post: Post) => {
    return post.reactions?.some(r => r.user_id === user?.id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Familial" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/circles">
              <Button variant="ghost" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Circles
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Create Post */}
        {circles.length > 0 ? (
          <Card className="mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {profile?.display_name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{profile?.display_name || "You"}</p>
                  <Select value={selectedCircle} onValueChange={setSelectedCircle}>
                    <SelectTrigger className="w-fit h-7 text-xs border-none p-0 text-muted-foreground">
                      <SelectValue placeholder="Select circle" />
                    </SelectTrigger>
                    <SelectContent>
                      {circles.map((circle) => (
                        <SelectItem key={circle.id} value={circle.id}>
                          {circle.name}
                        </SelectItem>
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
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleCreatePost} 
                  disabled={!newPostContent.trim() || isPosting}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isPosting ? "Posting..." : "Share"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Create Your First Circle
              </h3>
              <p className="text-muted-foreground mb-6">
                Circles are private spaces for your family or close friends.
              </p>
              <Link to="/circles">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create a Circle
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.length === 0 && circles.length > 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No posts yet. Be the first to share something with your circle!
                </p>
              </CardContent>
            </Card>
          )}
          
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={post.profiles?.avatar_url || undefined} />
                    <AvatarFallback>
                      {post.profiles?.display_name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">
                      {post.profiles?.display_name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {post.circles?.name} • {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-foreground whitespace-pre-wrap mb-4">{post.content}</p>
                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  <button
                    onClick={() => handleReaction(post.id)}
                    className={`flex items-center gap-2 text-sm transition-colors ${
                      hasUserReacted(post) 
                        ? "text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${hasUserReacted(post) ? "fill-current" : ""}`} />
                    <span>{post.reactions?.length || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    <span>{post.comments?.length || 0}</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Feed;
