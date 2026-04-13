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
import { Switch } from "@/components/ui/switch";
import { Camera, Save, ArrowLeft, LogOut, Trash2, Loader2, AlertTriangle, ChevronRight, Download, Shield, ShieldCheck, Smartphone, Bell, BellOff } from "lucide-react";
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

  // Notification preferences
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [mutedTypes, setMutedTypes] = useState<string[]>([]);
  const [notifPrefsLoaded, setNotifPrefsLoaded] = useState(false);

  // 2FA/MFA state (email-based)
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Session management
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
    }
  }, [profile]);

  // Load notification preferences
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setEmailEnabled((data as any).email_enabled ?? true);
        setPushEnabled((data as any).push_enabled ?? true);
        setMutedTypes((data as any).muted_types ?? []);
      }
      setNotifPrefsLoaded(true);
    })();
  }, [user]);

  // Load 2FA status from profile
  useEffect(() => {
    if (profile) {
      setMfaEnabled((profile as any).two_factor_enabled ?? false);
    }
  }, [profile]);

  const saveNotifPrefs = async (updates: { email_enabled?: boolean; push_enabled?: boolean; muted_types?: string[] }) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      email_enabled: updates.email_enabled ?? emailEnabled,
      push_enabled: updates.push_enabled ?? pushEnabled,
      muted_types: updates.muted_types ?? mutedTypes,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("notification_preferences").upsert(payload as any, { onConflict: "user_id" });
  };

  const toggleMutedType = async (type: string) => {
    const newMuted = mutedTypes.includes(type) ? mutedTypes.filter(t => t !== type) : [...mutedTypes, type];
    setMutedTypes(newMuted);
    await saveNotifPrefs({ muted_types: newMuted });
  };

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

      {/* Notification Preferences */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" /> Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifs">Email notifications</Label>
            <Switch id="email-notifs" checked={emailEnabled} onCheckedChange={async (v) => { setEmailEnabled(v); await saveNotifPrefs({ email_enabled: v }); }} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="push-notifs">Push notifications</Label>
            <Switch id="push-notifs" checked={pushEnabled} onCheckedChange={async (v) => { setPushEnabled(v); await saveNotifPrefs({ push_enabled: v }); }} />
          </div>
          <div className="border-t pt-3">
            <p className="text-sm text-muted-foreground mb-3">Mute specific notification types:</p>
            {["comments", "mentions", "events", "fridge_pins", "direct_messages", "campfire_stories"].map(type => (
              <div key={type} className="flex items-center justify-between py-1.5">
                <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                <Switch checked={mutedTypes.includes(type)} onCheckedChange={() => toggleMutedType(type)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication (Email-Based) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" /> Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaEnabled && !mfaEnrolling ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">2FA is enabled (email verification)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                A verification code will be sent to your email each time you sign in.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={mfaLoading}
                onClick={async () => {
                  setMfaLoading(true);
                  await supabase
                    .from("profiles")
                    .update({ two_factor_enabled: false } as any)
                    .eq("user_id", user!.id);
                  setMfaEnabled(false);
                  refetchProfile();
                  toast({ title: "2FA disabled" });
                  setMfaLoading(false);
                }}
                className="text-destructive"
              >
                Disable 2FA
              </Button>
            </div>
          ) : mfaEnrolling ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We've sent a 6-digit verification code to <strong>{user?.email}</strong>. Enter it below to enable 2FA.
              </p>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Verification code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setMfaEnrolling(false); setMfaVerifyCode(""); }}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={mfaVerifyCode.length !== 6 || mfaLoading}
                  onClick={async () => {
                    setMfaLoading(true);
                    const { data, error } = await supabase.functions.invoke("verify-2fa-code", {
                      body: { code: mfaVerifyCode },
                    });
                    if (error || !data?.success) {
                      toast({ title: "Invalid code", description: data?.error || "Please check your email and try again.", variant: "destructive" });
                    } else {
                      await supabase
                        .from("profiles")
                        .update({ two_factor_enabled: true } as any)
                        .eq("user_id", user!.id);
                      setMfaEnabled(true);
                      setMfaEnrolling(false);
                      setMfaVerifyCode("");
                      refetchProfile();
                      toast({ title: "2FA enabled!", description: "Your account is now protected with email-based two-factor authentication." });
                    }
                    setMfaLoading(false);
                  }}
                >
                  {mfaLoading ? "Verifying..." : "Verify & Enable"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security. When enabled, you'll receive a verification code via email each time you sign in.
              </p>
              <Button
                size="sm"
                disabled={mfaLoading}
                onClick={async () => {
                  setMfaLoading(true);
                  const { data, error } = await supabase.functions.invoke("send-2fa-code");
                  if (error || !data?.success) {
                    toast({ title: "Error", description: data?.error || "Failed to send verification code.", variant: "destructive" });
                    setMfaLoading(false);
                    return;
                  }
                  setMfaEnrolling(true);
                  setMfaLoading(false);
                  toast({ title: "Code sent!", description: "Check your email for the verification code." });
                }}
              >
                <Shield className="w-4 h-4 mr-2" />
                Enable 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5" /> Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Last sign-in: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Unknown"}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={signingOutOthers}
            onClick={async () => {
              setSigningOutOthers(true);
              const { error } = await supabase.auth.signOut({ scope: "others" });
              if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
              } else {
                toast({ title: "Done", description: "All other sessions have been signed out." });
              }
              setSigningOutOthers(false);
            }}
          >
            {signingOutOthers ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Sign Out All Other Devices
          </Button>
        </CardContent>
      </Card>

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
