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
import { ArrowLeft, Send, MessageSquare, Search, Users, Plus } from "lucide-react";

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
}

interface Conversation {
  user: Profile;
  lastMessage: Message;
  unreadCount: number;
}

const Messages = () => {
  const { user } = useAuth();
  const { circles, isLoading: contextLoading } = useCircleContext();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
      markAsRead();
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;

    setIsLoadingConversations(true);
    const { data: allMessages } = await supabase
      .from("private_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!allMessages) {
      setIsLoadingConversations(false);
      return;
    }

    // Get unique users from messages
    const userIds = new Set<string>();
    allMessages.forEach(msg => {
      if (msg.sender_id !== user.id) userIds.add(msg.sender_id);
      if (msg.recipient_id !== user.id) userIds.add(msg.recipient_id);
    });

    if (userIds.size === 0) {
      setIsLoadingConversations(false);
      return;
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", Array.from(userIds));

    if (!profiles) {
      setIsLoadingConversations(false);
      return;
    }

    // Build conversations
    const convs: Conversation[] = [];
    profiles.forEach(profile => {
      const userMessages = allMessages.filter(
        msg => msg.sender_id === profile.user_id || msg.recipient_id === profile.user_id
      );
      const lastMessage = userMessages[0];
      const unreadCount = userMessages.filter(
        msg => msg.sender_id === profile.user_id && !msg.is_read
      ).length;

      convs.push({
        user: profile,
        lastMessage,
        unreadCount,
      });
    });

    // Sort by last message time
    convs.sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );

    setConversations(convs);
    setIsLoadingConversations(false);
  };

  const fetchMessages = async () => {
    if (!user || !selectedUser) return;

    const { data } = await supabase
      .from("private_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const markAsRead = async () => {
    if (!user || !selectedUser) return;

    await supabase
      .from("private_messages")
      .update({ is_read: true })
      .eq("sender_id", selectedUser.user_id)
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    setConversations(prev =>
      prev.map(c =>
        c.user.user_id === selectedUser.user_id
          ? { ...c, unreadCount: 0 }
          : c
      )
    );
  };

  // Escape ILIKE wildcards to prevent pattern injection
  const escapeILIKE = (str: string): string => {
    return str.replace(/[%_\\]/g, '\\$&');
  };

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    
    if (!trimmedQuery || !user) return;
    
    if (trimmedQuery.length > 50) {
      toast({
        title: "Search query too long",
        description: "Please use 50 characters or less",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    // Get all circle IDs the user belongs to
    const { data: ownedCircles } = await supabase
      .from("circles")
      .select("id")
      .eq("owner_id", user.id);

    const { data: memberCircles } = await supabase
      .from("circle_memberships")
      .select("circle_id")
      .eq("user_id", user.id);

    const circleIds = [
      ...(ownedCircles?.map(c => c.id) || []),
      ...(memberCircles?.map(c => c.circle_id) || []),
    ];

    if (circleIds.length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Get all users in those circles
    const { data: memberships } = await supabase
      .from("circle_memberships")
      .select("user_id")
      .in("circle_id", circleIds);

    const { data: circleOwners } = await supabase
      .from("circles")
      .select("owner_id")
      .in("id", circleIds);

    const userIds = new Set<string>();
    memberships?.forEach(m => userIds.add(m.user_id));
    circleOwners?.forEach(c => userIds.add(c.owner_id));
    userIds.delete(user.id);

    if (userIds.size === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const escapedQuery = escapeILIKE(trimmedQuery);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", Array.from(userIds))
      .ilike("display_name", `%${escapedQuery}%`);

    setSearchResults(profiles || []);
    setIsSearching(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedUser) return;

    setIsSending(true);

    const { error } = await supabase
      .from("private_messages")
      .insert({
        sender_id: user.id,
        recipient_id: selectedUser.user_id,
        content: newMessage.trim(),
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    } else {
      setNewMessage("");
      fetchMessages();
      fetchConversations();
    }

    setIsSending(false);
  };

  if (contextLoading || isLoadingConversations) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Skeleton className="h-9 w-32 mb-2" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-10" />
            </div>
          </CardContent>
        </Card>
        {[1, 2, 3].map(i => (
          <Card key={i} className="mb-3">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    );
  }

  if (circles.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              Create a Circle First
            </h2>
            <p className="text-muted-foreground mb-6">
              You need to create or join a circle before sending messages.
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
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      {selectedUser ? (
        // Chat View
        <div className="flex flex-col h-[calc(100vh-200px)]">
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} aria-label="Back to conversations">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Avatar>
              <AvatarImage src={selectedUser.avatar_url || undefined} />
              <AvatarFallback>
                {selectedUser.display_name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <h2 className="font-serif text-xl font-bold text-foreground">
              {selectedUser.display_name || "Unknown"}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Start a conversation with {selectedUser.display_name}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.sender_id === user?.id
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.sender_id === user?.id ? 'text-background/70' : 'text-muted-foreground'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              maxLength={5000}
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isSending} aria-label="Send message">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        // Conversations List
        <>
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="w-8 h-8" />
              Messages
            </h1>
            <p className="text-muted-foreground mt-1">
              Private conversations with circle members
            </p>
          </div>

          {/* Search */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search circle members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Search results:</p>
                  {searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer"
                      onClick={() => {
                        setSelectedUser(profile);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {profile.display_name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">
                        {profile.display_name || "Unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversations */}
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
                  No conversations yet
                </h2>
                <p className="text-muted-foreground">
                  Search for a circle member to start a conversation.
                </p>
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
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.user.avatar_url || undefined} />
                        <AvatarFallback>
                          {conv.user.display_name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium text-foreground ${conv.unreadCount > 0 ? 'font-semibold' : ''}`}>
                            {conv.user.display_name || "Unknown"}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(conv.lastMessage.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage.sender_id === user?.id ? "You: " : ""}
                          {conv.lastMessage.content}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="bg-foreground text-background text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default Messages;
