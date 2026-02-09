import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarDays, MapPin, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Circle {
  id: string;
  name: string;
  owner_id: string;
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
  circles?: Circle;
}

const Events = () => {
  const { user } = useAuth();
  const { circles, selectedCircle, setSelectedCircle, isLoading: contextLoading } = useCircleContext();
  const { toast } = useToast();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    if (circles.length > 0) {
      fetchEvents();
    } else if (!contextLoading) {
      setIsLoadingEvents(false);
    }
  }, [circles, selectedCircle, contextLoading]);

  const fetchEvents = async () => {
    if (circles.length === 0) return;
    
    setIsLoadingEvents(true);
    const circleIds = selectedCircle ? [selectedCircle] : circles.map(c => c.id);
    
    const { data, error } = await supabase
      .from("events")
      .select(`*, circles!events_circle_id_fkey(id, name)`)
      .in("circle_id", circleIds)
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(50);

    if (!error && data) {
      setEvents(data as unknown as Event[]);
    }
    setIsLoadingEvents(false);
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
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    } else {
      setTitle("");
      setDescription("");
      setEventTime("");
      setEventLocation("");
      setSelectedDate(new Date());
      setIsCreateOpen(false);
      fetchEvents();
      toast({
        title: "Event created!",
        description: "Your event has been added to the calendar.",
      });
    }

    setIsCreating(false);
  };

  const handleDeleteEvent = async (event: Event) => {
    if (!confirm(`Delete "${event.title}"?`)) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete event.",
        variant: "destructive",
      });
    } else {
      fetchEvents();
      toast({
        title: "Event deleted",
        description: "The event has been removed.",
      });
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
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
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

  const eventDates = events.map(e => new Date(e.event_date));

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Family Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Keep track of family events and celebrations
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">Create Event</DialogTitle>
              <DialogDescription>
                Add a new event to share with your circle.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Circle</Label>
                <Select value={selectedCircle} onValueChange={setSelectedCircle}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Grandma's Birthday"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time">Time (optional)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (optional)</Label>
                  <Input
                    id="location"
                    placeholder="Place"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
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
        {/* Calendar */}
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
              modifiersClassNames={{
                event: "bg-primary/20 text-primary font-semibold"
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">Upcoming Events</h2>
          
          {events.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No upcoming events</p>
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} className="group">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {event.circles?.name}
                      </p>
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
                        <p className="text-sm text-muted-foreground mt-2">
                          {event.description}
                        </p>
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
            ))
          )}
        </div>
      </div>
    </main>
  );
};

export default Events;
