import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarDays, MapPin, Clock, Trash2, Loader2, Image, Pencil, Check, X, UserCheck, HelpCircle, XCircle, Users } from "lucide-react";
import ReadOnlyBanner from "@/components/circles/ReadOnlyBanner";
import { format, parse } from "date-fns";

/** Parse "YYYY-MM-DD" as local date (avoids UTC-midnight timezone shift). */
const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatDateToYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatTime12h = (time: string): string => {
  try {
    const parsed = parse(time, "HH:mm:ss", new Date());
    return format(parsed, "h:mm a");
  } catch {
    try {
      const parsed = parse(time, "HH:mm", new Date());
      return format(parsed, "h:mm a");
    } catch {
      return time;
    }
  }
};

interface Circle {
  id: string;
  name: string;
  owner_id: string;
}

interface Album {
  id: string;
  name: string;
  circle_id: string;
}

interface RsvpProfile {
  display_name: string | null;
  avatar_url: string | null;
}

interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  profiles?: RsvpProfile;
}

interface Event {
  id: string;
  circle_id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_time: string | null;
  location: string | null;
  created_at: string;
  album_id: string | null;
  circles?: Circle;
  photo_albums?: Album | null;
}

const Events = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, profile, isLoading: contextLoading, isCircleReadOnly } = useCircleContext();
  const readOnly = isCircleReadOnly(selectedCircle);
  const { toast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, Rsvp[]>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [hasMorePast, setHasMorePast] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeTab, setActiveTab] = useState("upcoming");

  // Edit state
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editEndDate, setEditEndDate] = useState<Date | undefined>();
  const [editAlbumId, setEditAlbumId] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const PAGE_SIZE = 50;

  useEffect(() => {
    if (circles.length > 0) {
      fetchEvents();
      fetchPastEvents();
      fetchAlbums();
    } else if (!contextLoading) {
      setIsLoadingEvents(false);
    }
  }, [circles, selectedCircle, contextLoading]);

  const fetchAlbums = async () => {
    const circleIds = selectedCircle ? [selectedCircle] : circles.map(c => c.id);
    const { data } = await supabase
      .from("photo_albums")
      .select("id, name, circle_id")
      .in("circle_id", circleIds)
      .order("name");
    if (data) setAlbums(data);
  };

  const fetchRsvps = async (eventIds: string[]) => {
    if (eventIds.length === 0) return;
    const { data } = await supabase
      .from("event_rsvps")
      .select("id, event_id, user_id, status")
      .in("event_id", eventIds);
    if (data && data.length > 0) {
      // Fetch profiles for RSVP users
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const grouped: Record<string, Rsvp[]> = {};
      for (const rsvp of data) {
        const profile = profileMap.get(rsvp.user_id);
        const enriched: Rsvp = {
          ...rsvp,
          profiles: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : undefined,
        };
        if (!grouped[rsvp.event_id]) grouped[rsvp.event_id] = [];
        grouped[rsvp.event_id].push(enriched);
      }
      setRsvps(prev => ({ ...prev, ...grouped }));
    }
  };

  const fetchEvents = async (reset = true) => {
    if (circles.length === 0) return;
    if (reset) setIsLoadingEvents(true);
    const circleIds = selectedCircle ? [selectedCircle] : circles.map(c => c.id);
    const cursor = !reset && events.length > 0 ? events[events.length - 1].event_date : null;

    let query = supabase
      .from("events")
      .select(`*, circles!events_circle_id_fkey(id, name), photo_albums(id, name, circle_id)`)
      .in("circle_id", circleIds)
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) query = query.gt("event_date", cursor);

    const { data, error } = await query;
    if (!error && data) {
      const typed = data as unknown as Event[];
      setEvents(prev => reset ? typed : [...prev, ...typed]);
      setHasMore(typed.length === PAGE_SIZE);
      fetchRsvps(typed.map(e => e.id));
    }
    setIsLoadingEvents(false);
  };

  const fetchPastEvents = async (reset = true) => {
    if (circles.length === 0) return;
    const circleIds = selectedCircle ? [selectedCircle] : circles.map(c => c.id);
    const cursor = !reset && pastEvents.length > 0 ? pastEvents[pastEvents.length - 1].event_date : null;

    let query = supabase
      .from("events")
      .select(`*, circles!events_circle_id_fkey(id, name), photo_albums(id, name, circle_id)`)
      .in("circle_id", circleIds)
      .lt("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) query = query.lt("event_date", cursor);

    const { data, error } = await query;
    if (!error && data) {
      const typed = data as unknown as Event[];
      setPastEvents(prev => reset ? typed : [...prev, ...typed]);
      setHasMorePast(typed.length === PAGE_SIZE);
      fetchRsvps(typed.map(e => e.id));
    }
  };

  const handleCreateEvent = async () => {
    if (!title.trim() || !selectedCircle || !selectedDate || !user) return;
    setIsCreating(true);

    const { error } = await supabase
      .from("events")
      .insert({
        title,
        description: description || null,
        circle_id: selectedCircle,
        created_by: user.id,
        event_date: formatDateToYMD(selectedDate),
        end_date: selectedEndDate ? formatDateToYMD(selectedEndDate) : null,
        event_time: eventTime || null,
        location: eventLocation || null,
        album_id: selectedAlbumId && selectedAlbumId !== "none" ? selectedAlbumId : null,
      });

    if (error) {
      toast({ title: "Error", description: "Failed to create event. Please try again.", variant: "destructive" });
    } else {
      setTitle("");
      setDescription("");
      setEventTime("");
      setEventLocation("");
      setSelectedAlbumId("");
      setSelectedDate(new Date());
      setSelectedEndDate(undefined);
      setIsCreateOpen(false);
      fetchEvents();
      fetchPastEvents();
      toast({ title: "Event created!", description: "Your event has been added to the calendar." });
    }
    setIsCreating(false);
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditDescription(event.description || "");
    setEditTime(event.event_time || "");
    setEditLocation(event.location || "");
    const [year, month, day] = event.event_date.split("-").map(Number);
    setEditDate(new Date(year, month - 1, day));
    setEditEndDate(event.end_date ? parseLocalDate(event.end_date) : undefined);
    setEditAlbumId(event.album_id || "none");
  };

  const handleSaveEdit = async () => {
    if (!editingEvent || !editTitle.trim() || !editDate) return;
    setIsSavingEdit(true);

    const { error } = await supabase
      .from("events")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        event_date: formatDateToYMD(editDate),
        end_date: editEndDate ? formatDateToYMD(editEndDate) : null,
        event_time: editTime || null,
        location: editLocation.trim() || null,
        album_id: editAlbumId && editAlbumId !== "none" ? editAlbumId : null,
      })
      .eq("id", editingEvent.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update event.", variant: "destructive" });
    } else {
      setEditingEvent(null);
      fetchEvents();
      fetchPastEvents();
      toast({ title: "Event updated!" });
    }
    setIsSavingEdit(false);
  };

  const handleDeleteEvent = async (event: Event) => {
    if (!confirm(`Delete "${event.title}"?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete event.", variant: "destructive" });
    } else {
      fetchEvents();
      fetchPastEvents();
      toast({ title: "Event deleted", description: "The event has been removed." });
    }
  };

  const handleRsvp = async (eventId: string, status: string) => {
    if (!user) return;

    const eventRsvps = rsvps[eventId] || [];
    const myRsvp = eventRsvps.find(r => r.user_id === user.id);

    if (myRsvp && myRsvp.status === status) {
      // Remove RSVP
      const { error } = await supabase.from("event_rsvps").delete().eq("id", myRsvp.id);
      if (!error) {
        setRsvps(prev => ({
          ...prev,
          [eventId]: (prev[eventId] || []).filter(r => r.id !== myRsvp.id),
        }));
      }
    } else if (myRsvp) {
      // Update RSVP
      const { error } = await supabase.from("event_rsvps").update({ status }).eq("id", myRsvp.id);
      if (!error) {
        setRsvps(prev => ({
          ...prev,
          [eventId]: (prev[eventId] || []).map(r => r.id === myRsvp.id ? { ...r, status } : r),
        }));
      }
    } else {
      // Insert RSVP
      const { data, error } = await supabase
        .from("event_rsvps")
        .insert({ event_id: eventId, user_id: user.id, status })
        .select("id, event_id, user_id, status")
        .single();
      if (!error && data) {
        const enriched: Rsvp = {
          ...(data as unknown as Rsvp),
          profiles: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : undefined,
        };
        setRsvps(prev => ({
          ...prev,
          [eventId]: [...(prev[eventId] || []), enriched],
        }));
      }
    }
  };

  if (contextLoading || isLoadingEvents) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="py-4">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const allEvents = [...events, ...pastEvents];
  // Build array of all event dates (including ranges) for calendar highlights
  const eventDates: Date[] = [];
  for (const e of allEvents) {
    const start = parseLocalDate(e.event_date);
    const end = e.end_date ? parseLocalDate(e.end_date) : start;
    const current = new Date(start);
    while (current <= end) {
      eventDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }

  const renderRsvpSection = (event: Event) => {
    const eventRsvps = rsvps[event.id] || [];
    const myRsvp = eventRsvps.find(r => r.user_id === user?.id);
    const goingCount = eventRsvps.filter(r => r.status === "going").length;
    const maybeCount = eventRsvps.filter(r => r.status === "maybe").length;
    const notGoingCount = eventRsvps.filter(r => r.status === "not_going").length;

    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={myRsvp?.status === "going" ? "default" : "outline"}
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleRsvp(event.id, "going"); }}
            className="h-7 text-xs gap-1"
          >
            <UserCheck className="w-3 h-3" />
            Going
          </Button>
          <Button
            variant={myRsvp?.status === "maybe" ? "default" : "outline"}
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleRsvp(event.id, "maybe"); }}
            className="h-7 text-xs gap-1"
          >
            <HelpCircle className="w-3 h-3" />
            Maybe
          </Button>
          <Button
            variant={myRsvp?.status === "not_going" ? "default" : "outline"}
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleRsvp(event.id, "not_going"); }}
            className="h-7 text-xs gap-1"
          >
            <XCircle className="w-3 h-3" />
            Can't Go
          </Button>
        </div>
        {eventRsvps.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {goingCount > 0 && `${goingCount} going`}
                {goingCount > 0 && maybeCount > 0 && " · "}
                {maybeCount > 0 && `${maybeCount} maybe`}
                {(goingCount > 0 || maybeCount > 0) && notGoingCount > 0 && " · "}
                {notGoingCount > 0 && `${notGoingCount} can't go`}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <h4 className="text-sm font-semibold mb-2">RSVPs</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {eventRsvps.map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={r.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {(r.profiles?.display_name || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1 truncate">{r.profiles?.display_name || "Unknown"}</span>
                    <Badge variant={r.status === "going" ? "default" : "secondary"} className="text-xs h-5">
                      {r.status === "going" ? "Going" : r.status === "maybe" ? "Maybe" : "Can't go"}
                    </Badge>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  };

  const renderEventCard = (event: Event) => (
    <Card key={event.id} className="group">
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <h3 className="font-semibold text-foreground">{event.title}</h3>
            <p className="text-sm text-muted-foreground">{event.circles?.name}</p>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {format(parseLocalDate(event.event_date), "MMM d, yyyy")}
                {event.end_date && event.end_date !== event.event_date && (
                  <> – {format(parseLocalDate(event.end_date), "MMM d, yyyy")}</>
                )}
              </span>
              {event.event_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime12h(event.event_time)}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {event.location}
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
            )}
            {event.photo_albums && (
              <Link
                to={`/albums?circle=${event.circle_id}&album=${event.photo_albums.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Image className="w-4 h-4" />
                {event.photo_albums.name}
              </Link>
            )}
            {renderRsvpSection(event)}
          </div>
          {event.created_by === user?.id && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(event)}
                aria-label={`Edit event ${event.title}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteEvent(event)}
                aria-label={`Delete event ${event.title}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const editAlbumOptions = editingEvent
    ? albums.filter(a => a.circle_id === editingEvent.circle_id)
    : [];

  const availableAlbums = selectedCircle
    ? albums.filter(a => a.circle_id === selectedCircle)
    : albums;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <ReadOnlyBanner circleId={selectedCircle} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Family Calendar</h1>
          <p className="text-muted-foreground mt-1">Keep track of family events and celebrations</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={readOnly}><Plus className="w-4 h-4 mr-2" />Add Event</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">Create Event</DialogTitle>
              <DialogDescription>Add a new event to share with your circle.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Circle</Label>
                <Select value={selectedCircle} onValueChange={setSelectedCircle}>
                  <SelectTrigger><SelectValue placeholder="Select circle" /></SelectTrigger>
                  <SelectContent>
                    {circles.map((circle) => (
                      <SelectItem key={circle.id} value={circle.id}>{circle.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input id="title" placeholder="e.g., Grandma's Birthday" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Calendar mode="single" selected={selectedDate} onSelect={(day) => { setSelectedDate(day); if (day && selectedEndDate && day > selectedEndDate) setSelectedEndDate(undefined); }} className="rounded-md border" />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional, for multi-day)</Label>
                <Calendar mode="single" selected={selectedEndDate} onSelect={setSelectedEndDate} disabled={(date) => !!(selectedDate && date < selectedDate)} className="rounded-md border" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time">Time (optional)</Label>
                  <Input id="time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (optional)</Label>
                  <Input id="location" placeholder="Place" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} maxLength={300} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Photo Album (optional)</Label>
                <Select value={selectedAlbumId} onValueChange={setSelectedAlbumId}>
                  <SelectTrigger><SelectValue placeholder="Link a photo album" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No album</SelectItem>
                    {availableAlbums.map((album) => (
                      <SelectItem key={album.id} value={album.id}>{album.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" placeholder="Add details..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
              </div>
              <Button className="w-full" onClick={handleCreateEvent} disabled={!title.trim() || !selectedCircle || !selectedDate || isCreating}>
                {isCreating ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Event Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Event</DialogTitle>
            <DialogDescription>Update the event details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Event Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Calendar mode="single" selected={editDate} onSelect={(day) => { if (day) { setEditDate(day); if (editEndDate && day > editEndDate) setEditEndDate(undefined); } }} className="rounded-md border" />
            </div>
            <div className="space-y-2">
              <Label>End Date (optional, for multi-day)</Label>
              <Calendar mode="single" selected={editEndDate} onSelect={setEditEndDate} disabled={(date) => !!(editDate && date < editDate)} className="rounded-md border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-time">Time (optional)</Label>
                <Input id="edit-time" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location (optional)</Label>
                <Input id="edit-location" placeholder="Place" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} maxLength={300} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Photo Album (optional)</Label>
              <Select value={editAlbumId} onValueChange={setEditAlbumId}>
                <SelectTrigger><SelectValue placeholder="Link a photo album" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No album</SelectItem>
                  {editAlbumOptions.map((album) => (
                    <SelectItem key={album.id} value={album.id}>{album.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={2000} />
            </div>
            <Button className="w-full" onClick={handleSaveEdit} disabled={!editTitle.trim() || !editDate || isSavingEdit}>
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{ event: eventDates }}
              modifiersClassNames={{ event: "bg-primary/20 text-primary font-semibold" }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
              <TabsTrigger value="past" className="flex-1">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4 mt-4">
              {events.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No upcoming events</p>
                  </CardContent>
                </Card>
              ) : (
                events.map(renderEventCard)
              )}
              {hasMore && (
                <div className="text-center py-4">
                  <Button variant="outline" onClick={() => fetchEvents(false)}>
                    <Loader2 className="w-4 h-4 mr-2" />Load More
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4 mt-4">
              {pastEvents.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No past events</p>
                  </CardContent>
                </Card>
              ) : (
                pastEvents.map(renderEventCard)
              )}
              {hasMorePast && (
                <div className="text-center py-4">
                  <Button variant="outline" onClick={() => fetchPastEvents(false)}>
                    <Loader2 className="w-4 h-4 mr-2" />Load More
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
};

export default Events;
