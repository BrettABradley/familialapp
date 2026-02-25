import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Send, MessageSquare, Search, Users, Plus, UsersRound, Pencil, Camera, Trash2, Paperclip, X } from "lucide-react";
import ReadOnlyBanner from "@/components/circles/ReadOnlyBanner";
import { VoiceRecorder } from "@/components/shared/VoiceRecorder";
import { validateFileSize, getFileMediaType, getMediaType } from "@/lib/mediaUtils";
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

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  media_urls?: string[];
}

interface Conversation {
  user: Profile;
  lastMessage: Message;
  unreadCount: number;
}

interface GroupChat {
  id: string;
  name: string;
  circle_id: string;
  created_by: string;
  created_at: string;
  avatar_url?: string | null;
}

interface GroupMessage {
  id: string;
  group_chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  media_urls?: string[];
}

type ChatView = "list" | "dm" | "group";

const Messages = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, isLoading: contextLoading, isCircleReadOnly } = useCircleContext();
  const readOnly = isCircleReadOnly(selectedCircle);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [circleMembers, setCircleMembers] = useState<Profile[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Media attachment state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group chat state
  const [chatView, setChatView] = useState<ChatView>("list");
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMemberProfiles, setGroupMemberProfiles] = useState<Map<string, Profile>>(new Map());
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Group chat edit state
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);

  useEffect(() => {
    if (user && selectedCircle) {
      fetchConversations();
      fetchCircleMembers();
      fetchGroupChats();
    } else if (!contextLoading) {
      setIsLoadingConversations(false);
    }
  }, [user, selectedCircle]);

  // Realtime for DMs
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('private-messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, (payload) => {
        const newMsg = payload.new as Message;
        if (newMsg.sender_id !== user.id && newMsg.recipient_id !== user.id) return;
        if (selectedUser && (newMsg.sender_id === selectedUser.user_id || newMsg.recipient_id === selectedUser.user_id)) {
          setMessages(prev => [...prev, newMsg]);
          if (newMsg.recipient_id === user.id) {
            supabase.from("private_messages").update({ is_read: true }).eq("id", newMsg.id).then();
          }
        }
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUser]);

  // Realtime for group messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('group-messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_chat_messages' }, (payload) => {
        const newMsg = payload.new as GroupMessage;
        if (selectedGroup && newMsg.group_chat_id === selectedGroup.id) {
          setGroupMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedGroup]);

  useEffect(() => {
    if (selectedUser) { fetchMessages(); markAsRead(); setChatView("dm"); }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedGroup) { fetchGroupMessages(); setChatView("group"); }
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, groupMessages]);

  const fetchCircleMembers = async () => {
    if (!user || !selectedCircle) return;

    // Get memberships for the selected circle
    const { data: memberships } = await supabase.from("circle_memberships").select("user_id").eq("circle_id", selectedCircle);
    // Get the circle owner
    const { data: circle } = await supabase.from("circles").select("owner_id").eq("id", selectedCircle).single();

    const userIds = new Set<string>();
    memberships?.forEach(m => userIds.add(m.user_id));
    if (circle) userIds.add(circle.owner_id);
    userIds.delete(user.id);

    if (userIds.size === 0) { setCircleMembers([]); return; }

    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", Array.from(userIds));
    setCircleMembers(profiles || []);
  };

  const fetchConversations = async () => {
    if (!user || !selectedCircle) return;
    setIsLoadingConversations(true);

    // Get member IDs for this circle
    const { data: memberships } = await supabase.from("circle_memberships").select("user_id").eq("circle_id", selectedCircle);
    const { data: circle } = await supabase.from("circles").select("owner_id").eq("id", selectedCircle).single();
    const circleMemberIds = new Set<string>();
    memberships?.forEach(m => circleMemberIds.add(m.user_id));
    if (circle) circleMemberIds.add(circle.owner_id);
    circleMemberIds.delete(user.id);

    if (circleMemberIds.size === 0) { setConversations([]); setIsLoadingConversations(false); return; }

    const { data: allMessages } = await supabase
      .from("private_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!allMessages) { setIsLoadingConversations(false); return; }

    // Filter messages to only those with circle members
    const filteredMessages = allMessages.filter(msg => {
      const otherId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      return circleMemberIds.has(otherId);
    });

    const userIds = new Set<string>();
    filteredMessages.forEach(msg => {
      if (msg.sender_id !== user.id) userIds.add(msg.sender_id);
      if (msg.recipient_id !== user.id) userIds.add(msg.recipient_id);
    });

    if (userIds.size === 0) { setConversations([]); setIsLoadingConversations(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", Array.from(userIds));
    if (!profiles) { setIsLoadingConversations(false); return; }

    const convs: Conversation[] = [];
    profiles.forEach(profile => {
      const userMessages = filteredMessages.filter(msg => msg.sender_id === profile.user_id || msg.recipient_id === profile.user_id);
      const lastMessage = userMessages[0];
      if (!lastMessage) return;
      const unreadCount = userMessages.filter(msg => msg.sender_id === profile.user_id && !msg.is_read).length;
      convs.push({ user: profile, lastMessage, unreadCount });
    });
    convs.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
    setConversations(convs);
    setIsLoadingConversations(false);
  };

  const fetchMessages = async () => {
    if (!user || !selectedUser) return;
    const { data } = await supabase
      .from("private_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const markAsRead = async () => {
    if (!user || !selectedUser) return;
    await supabase.from("private_messages").update({ is_read: true }).eq("sender_id", selectedUser.user_id).eq("recipient_id", user.id).eq("is_read", false);
    setConversations(prev => prev.map(c => c.user.user_id === selectedUser.user_id ? { ...c, unreadCount: 0 } : c));
  };

  const fetchGroupChats = async () => {
    if (!user || !selectedCircle) return;
    const { data: memberOf } = await supabase.from("group_chat_members").select("group_chat_id").eq("user_id", user.id);
    if (!memberOf || memberOf.length === 0) { setGroupChats([]); return; }
    const groupIds = memberOf.map(m => m.group_chat_id);
    const { data } = await supabase.from("group_chats").select("*").in("id", groupIds).eq("circle_id", selectedCircle).order("created_at", { ascending: false });
    if (data) setGroupChats(data as GroupChat[]);
  };

  const fetchGroupMessages = async () => {
    if (!selectedGroup) return;
    const { data } = await supabase
      .from("group_chat_messages")
      .select("*")
      .eq("group_chat_id", selectedGroup.id)
      .order("created_at", { ascending: true });
    if (data) {
      setGroupMessages(data as GroupMessage[]);
      // Fetch profiles for senders
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", senderIds);
        if (profiles) {
          const map = new Map<string, Profile>();
          profiles.forEach(p => map.set(p.user_id, p));
          setGroupMemberProfiles(map);
        }
      }
    }
  };

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Group members dialog state
  const [isViewMembersOpen, setIsViewMembersOpen] = useState(false);
  const [groupMembersList, setGroupMembersList] = useState<Profile[]>([]);

  const fetchGroupMembers = async (groupId: string) => {
    const { data: members } = await supabase.from("group_chat_members").select("user_id").eq("group_chat_id", groupId);
    if (!members || members.length === 0) { setGroupMembersList([]); return; }
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
    setGroupMembersList(profiles || []);
  };

  const handleViewMembers = async () => {
    if (!selectedGroup) return;
    await fetchGroupMembers(selectedGroup.id);
    setIsViewMembersOpen(true);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user || selectedMemberIds.size === 0 || isCreatingGroup) return;

    if (!selectedCircle) return;
    const circleId = selectedCircle;
    setIsCreatingGroup(true);

    const { data: group, error } = await supabase
      .from("group_chats")
      .insert({ name: newGroupName.trim(), circle_id: circleId, created_by: user.id })
      .select()
      .maybeSingle();

    if (error || !group) {
      toast({ title: "Error", description: "Failed to create group chat.", variant: "destructive" });
      setIsCreatingGroup(false);
      return;
    }

    // Add members (including self)
    const members = [user.id, ...Array.from(selectedMemberIds)].map(uid => ({
      group_chat_id: group.id,
      user_id: uid,
    }));

    await supabase.from("group_chat_members").insert(members);

    // Notify added members (excluding self)
    const memberNotifications = Array.from(selectedMemberIds).map(uid => ({
      user_id: uid,
      type: "group_chat",
      title: "Added to group chat",
      message: `You were added to "${newGroupName.trim()}"`,
      related_circle_id: circleId,
      link: "/messages",
    }));
    if (memberNotifications.length > 0) {
      await supabase.from("notifications").insert(memberNotifications);
    }

    setNewGroupName("");
    setSelectedMemberIds(new Set());
    setIsCreateGroupOpen(false);
    setIsCreatingGroup(false);
    await fetchGroupChats();

    // Auto-open the newly created group chat
    setSelectedGroup(group as GroupChat);
    setChatView("group");
  };


  const handleEditGroup = () => {
    if (!selectedGroup) return;
    setEditGroupName(selectedGroup.name);
    setIsEditGroupOpen(true);
  };

  const handleSaveGroupName = async () => {
    if (!selectedGroup || !editGroupName.trim()) return;
    const { error } = await supabase
      .from("group_chats")
      .update({ name: editGroupName.trim() })
      .eq("id", selectedGroup.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update group name.", variant: "destructive" });
    } else {
      setSelectedGroup({ ...selectedGroup, name: editGroupName.trim() });
      setGroupChats(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, name: editGroupName.trim() } : g));
      setIsEditGroupOpen(false);
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedGroup || !user || !e.target.files?.[0]) return;
    setIsUploadingGroupAvatar(true);
    const file = e.target.files[0];
    const filePath = `group-chats/${selectedGroup.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Error", description: "Failed to upload image.", variant: "destructive" });
      setIsUploadingGroupAvatar(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const { error } = await supabase.from("group_chats").update({ avatar_url: publicUrl }).eq("id", selectedGroup.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update avatar.", variant: "destructive" });
    } else {
      setSelectedGroup({ ...selectedGroup, avatar_url: publicUrl });
      setGroupChats(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, avatar_url: publicUrl } : g));
    }
    setIsUploadingGroupAvatar(false);
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    // Delete members, messages, then the group chat
    await supabase.from("group_chat_messages").delete().eq("group_chat_id", selectedGroup.id);
    await supabase.from("group_chat_members").delete().eq("group_chat_id", selectedGroup.id);
    const { error } = await supabase.from("group_chats").delete().eq("id", selectedGroup.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete group chat.", variant: "destructive" });
    } else {
      setSelectedGroup(null);
      setChatView("list");
      setGroupChats(prev => prev.filter(g => g.id !== selectedGroup.id));
      setIsDeleteGroupOpen(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 4) {
      toast({ title: "Too many files", description: "You can attach up to 4 files per message.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    for (const file of files) {
      const error = validateFileSize(file);
      if (error) {
        toast({ title: "File too large", description: error, variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    setSelectedFiles(prev => [...prev, ...files]);
    files.forEach(file => setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVoiceRecording = (blob: Blob) => {
    if (selectedFiles.length >= 4) {
      toast({ title: "Too many files", description: "You can attach up to 4 files per message.", variant: "destructive" });
      return;
    }
    const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
    setSelectedFiles(prev => [...prev, file]);
    setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!user || selectedFiles.length === 0) return [];
    const uploadedUrls: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress(Math.round((i / selectedFiles.length) * 100));
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const { error } = await supabase.storage.from("post-media").upload(fileName, file);
      if (error) continue;
      const { data } = supabase.storage.from("post-media").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }
    setUploadProgress(100);
    return uploadedUrls;
  };

  const clearMediaState = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setUploadProgress(null);
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && selectedFiles.length === 0) || !user) return;
    setIsSending(true);

    let mediaUrls: string[] = [];
    if (selectedFiles.length > 0) mediaUrls = await uploadFiles();

    if (chatView === "dm" && selectedUser) {
      const { error } = await supabase.from("private_messages").insert({
        sender_id: user.id,
        recipient_id: selectedUser.user_id,
        content: newMessage.trim() || "",
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      } as any);
      if (error) {
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
      } else {
        setNewMessage("");
        clearMediaState();
        fetchMessages();
        fetchConversations();
      }
    } else if (chatView === "group" && selectedGroup) {
      const { error } = await supabase.from("group_chat_messages").insert({
        group_chat_id: selectedGroup.id,
        sender_id: user.id,
        content: newMessage.trim() || "",
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      } as any);
      if (error) {
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
      } else {
        setNewMessage("");
        clearMediaState();
        fetchGroupMessages();
      }
    }

    setIsSending(false);
  };

  const renderMediaAttachments = (mediaUrls?: string[]) => {
    if (!mediaUrls || mediaUrls.length === 0) return null;
    return (
      <div className="mt-2 space-y-2">
        {mediaUrls.map((url, i) => {
          const type = getMediaType(url);
          if (type === 'video') return <video key={i} src={url} controls playsInline className="rounded-md max-w-full max-h-48" />;
          if (type === 'audio') return <audio key={i} src={url} controls className="w-full max-w-[240px]" />;
          return <img key={i} src={url} alt="attachment" className="rounded-md max-w-full max-h-48 cursor-pointer" />;
        })}
      </div>
    );
  };

  const renderFilePreviewBar = () => {
    if (previewUrls.length === 0) return null;
    return (
      <div className="flex gap-2 p-2 overflow-x-auto">
        {previewUrls.map((url, index) => {
          const file = selectedFiles[index];
          const mediaType = getFileMediaType(file);
          return (
            <div key={index} className="relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border border-border">
              {mediaType === 'video' ? (
                <video src={url} className="w-full h-full object-cover" muted />
              ) : mediaType === 'audio' ? (
                <div className="w-full h-full flex items-center justify-center bg-secondary text-xs text-muted-foreground">🎵</div>
              ) : (
                <img src={url} alt="" className="w-full h-full object-cover" />
              )}
              <button onClick={() => removeFile(index)} className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderUploadProgress = () => {
    if (uploadProgress === null) return null;
    return (
      <div className="px-2 pb-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Uploading...</span>
          <span>{uploadProgress}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      </div>
    );
  };

  const renderMessageInput = () => (
    <div className="border-t border-border pt-2 space-y-2">
      {renderFilePreviewBar()}
      {renderUploadProgress()}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple onChange={handleFileSelect} className="hidden" />
        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSending} className="flex-shrink-0">
          <Paperclip className="w-4 h-4" />
        </Button>
        <VoiceRecorder onRecordingComplete={handleVoiceRecording} />
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
          maxLength={5000}
          className="flex-1"
        />
        <Button onClick={handleSendMessage} disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending} className="flex-shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const filteredMembers = searchQuery.trim()
    ? circleMembers.filter(p => p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : circleMembers;

  const showMemberList = isSearchFocused && filteredMembers.length > 0;

  if (contextLoading || isLoadingConversations) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8"><Skeleton className="h-9 w-32 mb-2" /><Skeleton className="h-5 w-56" /></div>
        <Card className="mb-6"><CardContent className="py-4"><div className="flex gap-2"><Skeleton className="h-10 flex-1" /><Skeleton className="h-10 w-10" /></div></CardContent></Card>
        {[1, 2, 3].map(i => (
          <Card key={i} className="mb-3"><CardContent className="py-4"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1"><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-4 w-48" /></div></div></CardContent></Card>
        ))}
      </main>
    );
  }

  if (circles.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card><CardContent className="py-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Create a Circle First</h2>
          <p className="text-muted-foreground mb-6">You need to create or join a circle before sending messages.</p>
          <Link to="/circles"><Button><Plus className="w-4 h-4 mr-2" />Create a Circle</Button></Link>
        </CardContent></Card>
      </main>
    );
  }

  // Chat view (DM or Group)
  if (chatView === "dm" && selectedUser) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex flex-col h-[calc(100vh-200px)]">
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setChatView("list"); clearMediaState(); }}><ArrowLeft className="w-4 h-4" /></Button>
            <Link to={`/profile/${selectedUser.user_id}`}>
              <Avatar><AvatarImage src={selectedUser.avatar_url || undefined} /><AvatarFallback>{selectedUser.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar>
            </Link>
            <Link to={`/profile/${selectedUser.user_id}`} className="hover:underline">
              <h2 className="font-serif text-xl font-bold text-foreground">{selectedUser.display_name || "Unknown"}</h2>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="text-center py-12"><MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Start a conversation with {selectedUser.display_name}</p></div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-lg px-4 py-2 ${msg.sender_id === user?.id ? 'bg-foreground text-background' : 'bg-secondary text-foreground'}`}>
                    {msg.content && <p>{msg.content}</p>}
                    {renderMediaAttachments(msg.media_urls)}
                    <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-background/70' : 'text-muted-foreground'}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          {readOnly ? (
            <p className="text-sm text-muted-foreground text-center py-2">This circle is read-only. Messaging is disabled.</p>
          ) : (
            renderMessageInput()
          )}
        </div>
      </main>
    );
  }

  if (chatView === "group" && selectedGroup) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex flex-col h-[calc(100vh-200px)]">
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedGroup(null); setChatView("list"); clearMediaState(); }}><ArrowLeft className="w-4 h-4" /></Button>
            <div className="relative group cursor-pointer">
              {selectedGroup.avatar_url ? (
                <Avatar><AvatarImage src={selectedGroup.avatar_url} /><AvatarFallback><UsersRound className="w-5 h-5" /></AvatarFallback></Avatar>
              ) : (
                <div className="p-2 rounded-full bg-secondary"><UsersRound className="w-5 h-5" /></div>
              )}
              {selectedGroup.created_by === user?.id && (
                <label className="absolute inset-0 flex items-center justify-center bg-foreground/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-4 h-4 text-background" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleGroupAvatarUpload} disabled={isUploadingGroupAvatar} />
                </label>
              )}
            </div>
            <button onClick={handleViewMembers} className="text-left hover:underline">
              <h2 className="font-serif text-xl font-bold text-foreground flex-1">{selectedGroup.name}</h2>
            </button>
            {selectedGroup.created_by === user?.id && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleEditGroup}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setIsDeleteGroupOpen(true)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            )}
          </div>

          {/* Delete Group Confirmation */}
          <AlertDialog open={isDeleteGroupOpen} onOpenChange={setIsDeleteGroupOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Group Chat</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{selectedGroup.name}" and all its messages. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Edit Group Name Dialog */}
          <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Edit Group Name</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} maxLength={100} placeholder="Group name" />
                <Button className="w-full" onClick={handleSaveGroupName} disabled={!editGroupName.trim()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* View Members Dialog */}
          <Dialog open={isViewMembersOpen} onOpenChange={setIsViewMembersOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Group Members</DialogTitle>
                <DialogDescription>{selectedGroup.name} — {groupMembersList.length} member{groupMembersList.length !== 1 ? 's' : ''}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                {groupMembersList.map(member => (
                  <Link key={member.user_id} to={`/profile/${member.user_id}`} onClick={() => setIsViewMembersOpen(false)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors">
                    <Avatar className="h-8 w-8"><AvatarImage src={member.avatar_url || undefined} /><AvatarFallback className="text-xs">{member.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium text-foreground">{member.display_name || "Unknown"}</span>
                    {member.user_id === selectedGroup.created_by && <span className="text-xs text-muted-foreground ml-auto">Creator</span>}
                  </Link>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {groupMessages.length === 0 ? (
              <div className="text-center py-12"><MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Start the group conversation</p></div>
            ) : (
              groupMessages.map((msg) => {
                const senderProfile = groupMemberProfiles.get(msg.sender_id);
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg px-4 py-2 ${isMe ? 'bg-foreground text-background' : 'bg-secondary text-foreground'}`}>
                      {!isMe && (
                        <Link to={`/profile/${msg.sender_id}`} className="text-xs font-semibold mb-1 opacity-70 hover:underline block">{senderProfile?.display_name || "Unknown"}</Link>
                      )}
                      {msg.content && <p>{msg.content}</p>}
                      {renderMediaAttachments(msg.media_urls)}
                      <p className={`text-xs mt-1 ${isMe ? 'text-background/70' : 'text-muted-foreground'}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          {readOnly ? (
            <p className="text-sm text-muted-foreground text-center py-2">This circle is read-only. Messaging is disabled.</p>
          ) : (
            renderMessageInput()
          )}
        </div>
      </main>
    );
  }

  // Conversations List
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <ReadOnlyBanner circleId={selectedCircle} />
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
          <MessageSquare className="w-8 h-8" />
          Messages
        </h1>
        <p className="text-muted-foreground mt-1">Private and group conversations with circle members</p>
      </div>

      {/* Search - shows all members on focus */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="relative">
            <div className="flex gap-2">
              <Input
                placeholder="Search circle members to message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              />
              <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" title="Create group chat" disabled={readOnly}><UsersRound className="w-4 h-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">Create Group Chat</DialogTitle>
                    <DialogDescription>Name your group and select members from your circles.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Group Name</Label>
                      <Input placeholder="e.g., Family Planning" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label>Select Members</Label>
                      <div className="max-h-48 overflow-y-auto space-y-2 border border-border rounded-md p-2">
                        {circleMembers.map(member => (
                          <label key={member.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer">
                            <Checkbox
                              checked={selectedMemberIds.has(member.user_id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedMemberIds);
                                if (checked) next.add(member.user_id); else next.delete(member.user_id);
                                setSelectedMemberIds(next);
                              }}
                            />
                            <Avatar className="h-8 w-8"><AvatarImage src={member.avatar_url || undefined} /><AvatarFallback className="text-xs">{member.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar>
                            <span className="text-sm font-medium text-foreground">{member.display_name || "Unknown"}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedMemberIds.size === 0 || isCreatingGroup}>
                      {isCreatingGroup ? "Creating..." : "Create Group"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {showMemberList && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                <p className="text-xs text-muted-foreground px-3 pt-2 pb-1">Circle members</p>
                {filteredMembers.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center gap-3 p-3 hover:bg-secondary cursor-pointer"
                    onMouseDown={() => {
                      setSelectedUser(profile);
                      setSearchQuery("");
                      setIsSearchFocused(false);
                    }}
                  >
                    <Avatar className="h-8 w-8"><AvatarImage src={profile.avatar_url || undefined} /><AvatarFallback className="text-xs">{profile.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium text-foreground">{profile.display_name || "Unknown"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Group Chats */}
      {groupChats.length > 0 && (
        <div className="mb-6">
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3 flex items-center gap-2"><UsersRound className="w-5 h-5" /> Group Chats</h2>
          <div className="space-y-3">
            {groupChats.map((gc) => (
              <Card key={gc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedGroup(gc)}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {gc.avatar_url ? (
                      <Avatar><AvatarImage src={gc.avatar_url} /><AvatarFallback><UsersRound className="w-5 h-5" /></AvatarFallback></Avatar>
                    ) : (
                      <div className="p-2 rounded-full bg-secondary"><UsersRound className="w-5 h-5" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{gc.name}</p>
                      <p className="text-xs text-muted-foreground">Created {new Date(gc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* DM Conversations */}
      <h2 className="font-serif text-lg font-semibold text-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Direct Messages</h2>
      {conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">No conversations yet</h2>
            <p className="text-muted-foreground">Click the search bar to find circle members and start a conversation.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <Card 
              key={conv.user.id} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${conv.unreadCount > 0 ? 'bg-secondary/30' : ''}`}
              onClick={() => setSelectedUser(conv.user)}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12"><AvatarImage src={conv.user.avatar_url || undefined} /><AvatarFallback>{conv.user.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`font-medium text-foreground ${conv.unreadCount > 0 ? 'font-semibold' : ''}`}>{conv.user.display_name || "Unknown"}</p>
                      <span className="text-xs text-muted-foreground">{new Date(conv.lastMessage.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessage.sender_id === user?.id ? "You: " : ""}{conv.lastMessage.content}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="bg-foreground text-background text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{conv.unreadCount}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default Messages;
