import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CircleHeader } from "@/components/layout/CircleHeader";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { ArrowLeft, Plus, Image, Trash2, Upload, X, Users } from "lucide-react";
import icon from "@/assets/icon.png";

interface Circle {
  id: string;
  name: string;
  owner_id: string;
}

interface Album {
  id: string;
  circle_id: string;
  name: string;
  description: string | null;
  cover_photo_url: string | null;
  created_by: string;
  created_at: string;
}

interface AlbumPhoto {
  id: string;
  album_id: string;
  photo_url: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

const Albums = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const circleIdParam = searchParams.get("circle");
  const albumIdParam = searchParams.get("album");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string>("");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [newAlbum, setNewAlbum] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCircles();
    }
  }, [user]);

  useEffect(() => {
    if (circleIdParam && circles.length > 0) {
      setSelectedCircle(circleIdParam);
    } else if (circles.length > 0 && !selectedCircle) {
      setSelectedCircle(circles[0].id);
    }
  }, [circles, circleIdParam]);

  useEffect(() => {
    if (selectedCircle) {
      fetchAlbums();
    }
  }, [selectedCircle]);

  useEffect(() => {
    if (albumIdParam && albums.length > 0) {
      const album = albums.find(a => a.id === albumIdParam);
      if (album) {
        setSelectedAlbum(album);
      }
    }
  }, [albums, albumIdParam]);

  useEffect(() => {
    if (selectedAlbum) {
      fetchPhotos();
    }
  }, [selectedAlbum]);

  const fetchCircles = async () => {
    if (!user) return;
    
    const { data: ownedCircles } = await supabase
      .from("circles")
      .select("id, name, owner_id")
      .eq("owner_id", user.id);

    const { data: memberCircles } = await supabase
      .from("circle_memberships")
      .select("circle_id, circles(id, name, owner_id)")
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
    setIsLoading(false);
  };

  const fetchAlbums = async () => {
    if (!selectedCircle) return;
    
    const { data, error } = await supabase
      .from("photo_albums")
      .select("*")
      .eq("circle_id", selectedCircle)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAlbums(data);
    }
  };

  const fetchPhotos = async () => {
    if (!selectedAlbum) return;
    
    const { data, error } = await supabase
      .from("album_photos")
      .select("*")
      .eq("album_id", selectedAlbum.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPhotos(data);
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbum.name.trim() || !user || !selectedCircle) return;

    const { error } = await supabase
      .from("photo_albums")
      .insert({
        circle_id: selectedCircle,
        name: newAlbum.name.trim(),
        description: newAlbum.description.trim() || null,
        created_by: user.id,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create album. Please try again.",
        variant: "destructive",
      });
    } else {
      setNewAlbum({ name: "", description: "" });
      setIsCreateOpen(false);
      fetchAlbums();
      toast({
        title: "Album created!",
        description: `${newAlbum.name} is ready for photos.`,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user || !selectedAlbum) return;

    setIsUploading(true);

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${selectedAlbum.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("post-media")
        .getPublicUrl(fileName);

      await supabase.from("album_photos").insert({
        album_id: selectedAlbum.id,
        photo_url: publicUrlData.publicUrl,
        uploaded_by: user.id,
      });
    }

    fetchPhotos();
    setIsUploading(false);
    toast({
      title: "Photos uploaded!",
      description: `${files.length} photo(s) added to the album.`,
    });
  };

  const handleDeletePhoto = async (photo: AlbumPhoto) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    const { error } = await supabase
      .from("album_photos")
      .delete()
      .eq("id", photo.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete photo.",
        variant: "destructive",
      });
    } else {
      fetchPhotos();
      toast({
        title: "Photo deleted",
      });
    }
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (!confirm(`Are you sure you want to delete "${album.name}"? All photos will be removed.`)) return;

    const { error } = await supabase
      .from("photo_albums")
      .delete()
      .eq("id", album.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete album.",
        variant: "destructive",
      });
    } else {
      setSelectedAlbum(null);
      fetchAlbums();
      toast({
        title: "Album deleted",
        description: `${album.name} has been removed.`,
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (circles.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={icon} alt="Familial" className="h-8 w-auto" />
              <span className="font-serif text-lg font-bold text-foreground">Familial</span>
            </Link>
            <Link to="/circles">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Create a Circle First
              </h3>
              <p className="text-muted-foreground mb-6">
                You need to create or join a circle before creating photo albums.
              </p>
              <Link to="/circles">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create a Circle
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <CircleHeader
        circles={circles}
        selectedCircle={selectedCircle}
        onCircleChange={setSelectedCircle}
        onSignOut={handleSignOut}
      />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {selectedAlbum ? (
          // Album Detail View
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAlbum(null)} className="mb-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Albums
                </Button>
                <h1 className="font-serif text-3xl font-bold text-foreground">{selectedAlbum.name}</h1>
                {selectedAlbum.description && (
                  <p className="text-muted-foreground mt-1">{selectedAlbum.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Add Photos"}
                </Button>
                {user && selectedAlbum.created_by === user.id && (
                  <Button variant="outline" onClick={() => handleDeleteAlbum(selectedAlbum)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            {photos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                    No photos yet
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Add some photos to this album.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden">
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || "Photo"}
                      className="w-full h-full object-cover"
                    />
                    {user && photo.uploaded_by === user.id && (
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="absolute top-2 right-2 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // Albums List View
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
                  <Image className="w-8 h-8" />
                  Photo Albums
                </h1>
                <p className="text-muted-foreground mt-1">
                  Organize and share family memories
                </p>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Album
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">Create Photo Album</DialogTitle>
                    <DialogDescription>
                      Create a new album to organize your photos.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="albumName">Album Name *</Label>
                      <Input
                        id="albumName"
                        placeholder="e.g., Summer Vacation 2024"
                        value={newAlbum.name}
                        onChange={(e) => setNewAlbum({ ...newAlbum, name: e.target.value })}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="albumDesc">Description</Label>
                      <Textarea
                        id="albumDesc"
                        placeholder="What's this album about?"
                        value={newAlbum.description}
                        onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })}
                        maxLength={500}
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleCreateAlbum}
                      disabled={!newAlbum.name.trim()}
                    >
                      Create Album
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {albums.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                    No albums yet
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Create an album to start organizing your photos.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {albums.map((album) => (
                  <Card 
                    key={album.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow group"
                    onClick={() => setSelectedAlbum(album)}
                  >
                    <div className="aspect-video bg-secondary relative overflow-hidden">
                      {album.cover_photo_url ? (
                        <img
                          src={album.cover_photo_url}
                          alt={album.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="font-serif text-lg">{album.name}</CardTitle>
                      {album.description && (
                        <CardDescription className="line-clamp-2">{album.description}</CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <MobileNavigation />
    </div>
  );
};

export default Albums;
