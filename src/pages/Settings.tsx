import { useState, useEffect, useRef } from "react";
import { useKeyboardDismissOnScroll } from "@/hooks/useKeyboardDismissOnScroll";
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
import { Camera, Save, ArrowLeft, LogOut, Trash2, Loader2, AlertTriangle, ChevronRight, Download } from "lucide-react";
import AvatarCropDialog from "@/components/profile/AvatarCropDialog";
import { convertHeicToJpeg } from "@/lib/heicConverter";
import { pickImage } from "@/lib/imagePicker";
import SubscriptionCard from "@/components/settings/SubscriptionCard";
import { isIOSNative, openAppleSubscriptionManagement } from "@/lib/iapPurchase";
import ReceiptHistory from "@/components/settings/ReceiptHistory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { profile, isLoading: contextLoading, refetchProfile } = useCircleContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  useKeyboardDismissOnScroll(mainRef);
  
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Delete account state — 0 = closed, 1–3 = step number
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
    }
  }, [profile]);

  const handlePickImage = async () => {
    try {
      const result = await pickImage();
      if (!result) return;

      const file = await convertHeicToJpeg(result.file);
      setPendingFile(file);

      const reader = new FileReader();
      reader.onload = () => setCropImageSrc(reader.result as string);
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ title: "Error", description: "Could not access camera or photos. Please check permissions.", variant: "destructive" });
    }
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await signOut();
      window.location.href = "/auth";
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete account. Please contact support.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteStep(0);
    setDeleteConfirmText("");
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
    <main ref={mainRef} className="container mx-auto px-4 py-8 max-w-2xl">
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
                onClick={handlePickImage}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 hover:bg-primary/90 transition-colors"
                aria-label="Upload profile photo"
              >
                <Camera className="w-4 h-4" />
              </button>
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
      {isIOSNative() && (
        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={openAppleSubscriptionManagement}>
            Manage Subscription (Apple)
          </Button>
        </div>
      )}
      <ReceiptHistory />

      {/* Sign Out — primary action */}
      <div className="mt-6">
        <Button
          variant="outline"
          onClick={async () => { await signOut(); window.location.href = "/auth"; }}
          className="w-full text-destructive hover:text-destructive border-destructive/30"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Data & Account */}
      <div className="mt-4 pb-24 flex flex-col items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={isDownloading}
          onClick={async () => {
            setIsDownloading(true);
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData.session?.access_token;
              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-my-data`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  },
                }
              );
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `familial-data-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast({ title: "Download started", description: "Your data export is downloading." });
            } catch {
              toast({ title: "Download failed", variant: "destructive" });
            } finally {
              setIsDownloading(false);
            }
          }}
          className="text-xs"
        >
          {isDownloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
          Download My Data
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteStep(1)}
          className="text-muted-foreground hover:text-destructive text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete Account
        </Button>
      </div>

      {/* 3-Step Delete Account Confirmation */}
      <AlertDialog open={deleteStep > 0} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <AlertDialogContent>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === deleteStep ? "w-6 bg-destructive" : s < deleteStep ? "w-4 bg-destructive/40" : "w-4 bg-muted"
                }`}
              />
            ))}
          </div>

          {deleteStep === 1 && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>This will <strong className="text-foreground">permanently delete</strong> your account. Here's what will happen:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>All your data will be permanently removed</li>
                      <li>Any active subscription will be canceled immediately</li>
                      <li>Circles you own with members will be placed on transfer block for others to claim</li>
                      <li>Empty circles you own will be deleted</li>
                    </ul>
                    <p className="font-medium text-foreground">This action cannot be undone.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDeleteDialog}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteStep(2)}
                >
                  I understand, continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </AlertDialogFooter>
            </>
          )}

          {deleteStep === 2 && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>What gets deleted (2/3)</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>The following will be <strong className="text-foreground">permanently erased</strong> across all circles:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Posts, comments, and reactions</li>
                      <li>Direct and group messages</li>
                      <li>Photos, albums, and fridge pins</li>
                      <li>Family tree entries you created</li>
                      <li>Event RSVPs and campfire stories</li>
                      <li>All circle memberships</li>
                      <li>Your profile and avatar</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      Circles you own that still have members will be placed on <strong className="text-foreground">transfer block</strong> so a member can claim ownership.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDeleteStep(1)}>Back</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteStep(3)}
                >
                  Continue to final step
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </AlertDialogFooter>
            </>
          )}

          {deleteStep === 3 && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Final confirmation (3/3)</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      This is your <strong className="text-foreground">last chance</strong>. Once you proceed, your account and all data will be gone forever.
                    </p>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="deleteConfirm" className="text-sm">
                        Type <strong>DELETE</strong> to confirm
                      </Label>
                      <Input
                        id="deleteConfirm"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDeleteStep(2)}>Back</Button>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete Forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default Settings;
