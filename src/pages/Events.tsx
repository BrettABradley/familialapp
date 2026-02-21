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
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarDays, MapPin, Clock, Trash2, Loader2, Image } from "lucide-react";
import { format } from "date-fns";

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

interface Event {
  id: string;
  circle_id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  created_at: string;
  album_id: string | null;
  circles?: Circle;
  photo_albums?: Album | null;
}

const Events = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: contextLoading } = useCircleContext();
  const { toast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
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
        event_date: format(selectedDate, "yyyy-MM-dd"),
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
      setIsCreateOpen(false);
      fetchEvents();
      fetchPastEvents();
      toast({ title: "Event created!", description: "Your event has been added to the calendar." });
    }
    setIsCreating(false);
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
  const eventDates = allEvents.map(e => new Date(e.event_date));

  const renderEventCard = (event: Event) => (
    <Card key={event.id} className="group">
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">{event.title}</h3>
            <p className="text-sm text-muted-foreground">{event.circles?.name}</p>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {format(new Date(event.event_date), "MMM d, yyyy")}
              </span>
              {event.event_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {event.event_time}
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
          </div>
          {event.created_by === user?.id && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDeleteEvent(event)}
              aria-label={`Delete event ${event.title}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Filter albums for the selected circle in create dialog
  const availableAlbums = selectedCircle
    ? albums.filter(a => a.circle_id === selectedCircle)
    : albums;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Family Calendar</h1>
          <p className="text-muted-foreground mt-1">Keep track of family events and celebrations</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Event</Button>
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
                <Label>Date</Label>
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-md border" />
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

              <Button
                className="w-full"
                onClick={handleCreateEvent}
                disabled={!title.trim() || !selectedCircle || !selectedDate || isCreating}
              >
                {isCreating ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
