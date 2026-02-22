import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Image, Trash2, Upload, X, Users, Camera, Pencil, Check, Download, ChevronLeft, ChevronRight } from "lucide-react";

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
  creator_name?: string;
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
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: contextLoading } = useCircleContext();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const circleIdParam = searchParams.get("circle");
  const albumIdParam = searchParams.get("album");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<AlbumPhoto | null>(null);
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  const [newAlbum, setNewAlbum] = useState({
    name: "",
    description: "",
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");

  const handleSaveTitle = async () => {
    if (!editTitleValue.trim() || !selectedAlbum) return;
    const { error } = await supabase
      .from("photo_albums")
      .update({ name: editTitleValue.trim() })
      .eq("id", selectedAlbum.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update album title.", variant: "destructive" });
    } else {
      setSelectedAlbum({ ...selectedAlbum, name: editTitleValue.trim() });
      setEditingTitle(false);
      fetchAlbums();
      toast({ title: "Title updated!" });
    }
  };

  useEffect(() => {
    if (circleIdParam && circles.length > 0) {
      setSelectedCircle(circleIdParam);
    }
  }, [circles, circleIdParam, setSelectedCircle]);

  useEffect(() => {
    if (selectedCircle) {
      fetchAlbums();
    } else if (!contextLoading) {
      setIsLoadingAlbums(false);
    }
  }, [selectedCircle, contextLoading]);

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

  const fetchAlbums = async () => {
    if (!selectedCircle) return;
    
    setIsLoadingAlbums(true);
    const { data, error } = await supabase
      .from("photo_albums")
      .select("*, profiles!photo_albums_created_by_fkey(display_name)")
      .eq("circle_id", selectedCircle)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAlbums(data.map((a: any) => ({
        ...a,
        creator_name: a.profiles?.display_name || "Unknown",
      })));
    }
    setIsLoadingAlbums(false);
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
      toast({ title: "Error", description: "Failed to create album. Please try again.", variant: "destructive" });
    } else {
      setNewAlbum({ name: "", description: "" });
      setIsCreateOpen(false);
      fetchAlbums();
      toast({ title: "Album created!", description: `${newAlbum.name} is ready for photos.` });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedAlbum) return;

    setIsUploadingCover(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `covers/${selectedAlbum.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("post-media")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Error", description: "Failed to upload cover photo.", variant: "destructive" });
      setIsUploadingCover(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("post-media")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("photo_albums")
      .update({ cover_photo_url: publicUrlData.publicUrl })
      .eq("id", selectedAlbum.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to update cover photo.", variant: "destructive" });
    } else {
      setSelectedAlbum({ ...selectedAlbum, cover_photo_url: publicUrlData.publicUrl });
      fetchAlbums();
      toast({ title: "Cover updated!", description: "Album cover photo has been changed." });
    }

    setIsUploadingCover(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
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

      if (uploadError) continue;

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
    toast({ title: "Photos uploaded!", description: `${files.length} photo(s) added to the album.` });
  };

  const extractStoragePath = (publicUrl: string): string | null => {
    try {
      const url = new URL(publicUrl);
      const match = url.pathname.match(/\/storage\/v1\/object\/public\/post-media\/(.+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const handleDeletePhoto = async (photo: AlbumPhoto) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    const storagePath = extractStoragePath(photo.photo_url);
    if (storagePath) {
      await supabase.storage.from("post-media").remove([storagePath]);
    }

    const { error } = await supabase.from("album_photos").delete().eq("id", photo.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete photo.", variant: "destructive" });
    } else {
      fetchPhotos();
      toast({ title: "Photo deleted" });
    }
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (!confirm(`Are you sure you want to delete "${album.name}"? All photos will be removed.`)) return;

    const { data: albumPhotos } = await supabase
      .from("album_photos")
      .select("photo_url")
      .eq("album_id", album.id);

    if (albumPhotos && albumPhotos.length > 0) {
      const paths = albumPhotos
        .map(p => extractStoragePath(p.photo_url))
        .filter((p): p is string => p !== null);
      if (paths.length > 0) {
        await supabase.storage.from("post-media").remove(paths);
      }
    }

    const { error } = await supabase.from("photo_albums").delete().eq("id", album.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete album.", variant: "destructive" });
    } else {
      setSelectedAlbum(null);
      fetchAlbums();
      toast({ title: "Album deleted", description: `${album.name} has been removed.` });
    }
  };

  if (contextLoading || isLoadingAlbums) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-9 w-40 mb-2" />
            <Skeleton className="h-5 w-56" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <Skeleton className="aspect-video" />
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  if (circles.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Create a Circle First</h2>
            <p className="text-muted-foreground mb-6">You need to create or join a circle before creating photo albums.</p>
            <Link to="/circles"><Button><Plus className="w-4 h-4 mr-2" />Create a Circle</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
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
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    className="font-serif text-2xl font-bold h-auto py-1"
                    maxLength={100}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveTitle} disabled={!editTitleValue.trim()}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-3xl font-bold text-foreground">{selectedAlbum.name}</h1>
                  {user && selectedAlbum.created_by === user.id && (
                    <Button size="sm" variant="ghost" onClick={() => { setEditTitleValue(selectedAlbum.name); setEditingTitle(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
              {selectedAlbum.description && (
                <p className="text-muted-foreground mt-1">{selectedAlbum.description}</p>
              )}
              {selectedAlbum.creator_name && (
                <p className="text-sm text-muted-foreground mt-1">Created by {selectedAlbum.creator_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
              >
                <Camera className="w-4 h-4 mr-2" />
                {isUploadingCover ? "Uploading..." : "Set Cover"}
              </Button>
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
                <Button variant="outline" onClick={() => handleDeleteAlbum(selectedAlbum)} aria-label={`Delete album ${selectedAlbum.name}`}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>

          {/* Cover Photo Preview */}
          {selectedAlbum.cover_photo_url && (
            <div className="mb-6 rounded-lg overflow-hidden aspect-[3/1] relative">
              <img
                src={selectedAlbum.cover_photo_url}
                alt={`${selectedAlbum.name} cover`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {photos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="font-serif text-xl font-semibold text-foreground mb-2">No photos yet</h2>
                <p className="text-muted-foreground mb-6">Add some photos to this album.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer" onClick={() => setEnlargedPhoto(photo)}>
                  <img src={photo.photo_url} alt={photo.caption || "Photo"} className="w-full h-full object-cover" />
                  {user && photo.uploaded_by === user.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }}
                      className="absolute top-2 right-2 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                      aria-label="Delete photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Enlarged photo dialog with navigation */}
          <Dialog open={!!enlargedPhoto} onOpenChange={(open) => !open && setEnlargedPhoto(null)}>
            <DialogContent className="max-w-3xl p-2 sm:p-4">
              <DialogTitle className="sr-only">{enlargedPhoto?.caption || "Photo"}</DialogTitle>
              {enlargedPhoto && (() => {
                const currentIndex = photos.findIndex(p => p.id === enlargedPhoto.id);
                return (
                  <div className="flex flex-col items-center">
                    <div className="relative group w-full flex items-center justify-center">
                      {photos.length > 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute left-2 z-10 bg-background/80 hover:bg-background"
                          disabled={currentIndex === 0}
                          onClick={() => setEnlargedPhoto(photos[currentIndex - 1])}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      )}
                      <img
                        src={enlargedPhoto.photo_url}
                        alt={enlargedPhoto.caption || "Photo"}
                        className="max-h-[80vh] w-auto rounded-md object-contain"
                      />
                      {photos.length > 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute right-2 z-10 bg-background/80 hover:bg-background"
                          disabled={currentIndex === photos.length - 1}
                          onClick={() => setEnlargedPhoto(photos[currentIndex + 1])}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      {photos.length > 1 && (
                        <span className="text-sm text-muted-foreground">{currentIndex + 1} / {photos.length}</span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement("a");
                          fetch(enlargedPhoto.photo_url)
                            .then(r => r.blob())
                            .then(blob => {
                              link.href = URL.createObjectURL(blob);
                              link.download = enlargedPhoto.photo_url.split("/").pop() || "photo.jpg";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(link.href);
                            });
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    {enlargedPhoto.caption && (
                      <p className="mt-2 text-sm text-muted-foreground">{enlargedPhoto.caption}</p>
                    )}
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
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
              <p className="text-muted-foreground mt-1">Organize and share family memories</p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Create Album</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">Create Photo Album</DialogTitle>
                  <DialogDescription>Create a new album to organize your photos.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="albumName">Album Name *</Label>
                    <Input id="albumName" placeholder="e.g., Summer Vacation 2024" value={newAlbum.name} onChange={(e) => setNewAlbum({ ...newAlbum, name: e.target.value })} maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="albumDesc">Description</Label>
                    <Textarea id="albumDesc" placeholder="What's this album about?" value={newAlbum.description} onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })} maxLength={500} />
                  </div>
                  <Button className="w-full" onClick={handleCreateAlbum} disabled={!newAlbum.name.trim()}>Create Album</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {albums.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="font-serif text-xl font-semibold text-foreground mb-2">No albums yet</h2>
                <p className="text-muted-foreground mb-6">Create an album to start organizing your photos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {albums.map((album) => (
                <Card 
                  key={album.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow group relative"
                  onClick={() => setSelectedAlbum(album)}
                >
                  {user && (album.created_by === user.id) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album); }}
                      className="absolute top-2 right-2 z-10 bg-background/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                      aria-label={`Delete album ${album.name}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  )}
                  <div className="aspect-video bg-secondary relative overflow-hidden">
                    {album.cover_photo_url ? (
                      <img src={album.cover_photo_url} alt={album.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">{album.name}</CardTitle>
                    <CardDescription>
                      {album.creator_name && `Created by ${album.creator_name} · `}
                      {new Date(album.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default Albums;
