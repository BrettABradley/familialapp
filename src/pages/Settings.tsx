import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Save, ArrowLeft } from "lucide-react";
import AvatarCropDialog from "@/components/profile/AvatarCropDialog";
import SubscriptionCard from "@/components/settings/SubscriptionCard";

const Settings = () => {
  const { user } = useAuth();
  const { profile, isLoading: contextLoading, refetchProfile } = useCircleContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
    }
  }, [profile]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleCroppedUpload = async (blob: Blob) => {
    setCropImageSrc(null);
    if (!user) return;

    setIsUploading(true);
    const ext = pendingFile?.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, blob, { upsert: true, contentType: blob.type });

    if (uploadError) {
      toast({ title: "Upload failed", description: "Could not upload avatar. Please try again.", variant: "destructive" });
      setIsUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq("user_id", user.id);

    if (updateError) {
      toast({ title: "Error", description: "Could not update profile avatar.", variant: "destructive" });
    } else {
      toast({ title: "Avatar updated!", description: "Your profile picture has been changed." });
      refetchProfile();
    }

    setIsUploading(false);
    setPendingFile(null);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        location,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: "Could not save profile. Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Profile saved!", description: "Your changes have been saved." });
      refetchProfile();
    }

    setIsSaving(false);
  };

  if (contextLoading) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader><Skeleton className="h-7 w-32" /></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4"><Skeleton className="h-24 w-24 rounded-full" /></div>
            <div className="space-y-4">
              <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-20 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="font-serif text-2xl">Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-2xl font-serif">
                  {displayName?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 hover:bg-primary/90 transition-colors"
                aria-label="Upload profile photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
            {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
          </div>

          {cropImageSrc && (
            <AvatarCropDialog
              open={!!cropImageSrc}
              imageSrc={cropImageSrc}
              onClose={() => { setCropImageSrc(null); setPendingFile(null); }}
              onCropComplete={handleCroppedUpload}
            />
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell your family a little about yourself..." className="resize-none" rows={3} maxLength={1000} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" maxLength={200} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <SubscriptionCard />
    </main>
  );
};

export default Settings;
