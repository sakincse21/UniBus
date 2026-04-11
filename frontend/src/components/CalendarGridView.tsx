"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchCalendarEvents,
  createPersonalFixture,
  deletePersonalFixture,
  deleteNotice,
} from "@/lib/action/calendar";
import { ICalendarEvent, ICreateFixturePayload } from "@/lib/interfaces";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  events: ICalendarEvent[];
}

interface CalendarWeek {
  days: CalendarDay[];
}

// Utility function to format date to local YYYY-MM-DD format
const formatLocalDate = (date: Date): string => {
  return date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
};

export default function CalendarGridView() {
  const [events, setEvents] = useState<ICalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showFixtureDialog, setShowFixtureDialog] = useState(false);
  const [showDateDetailsDialog, setShowDateDetailsDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [fixtureData, setFixtureData] = useState({
    title: "",
    description: "",
    startDateTime: "",
    endDateTime: "",
    isAllDay: false,
  });

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchCalendarEvents(120);
      if (result.success) {
        setEvents(result.data);
      }
    } catch (error) {
      toast.error("Failed to load calendar events");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Generate calendar weeks for current month
  const generateCalendarWeeks = (): CalendarWeek[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const weeks: CalendarWeek[] = [];
    const currentDateIterator = new Date(startDate);

    while (weeks.length < 6) {
      const week: CalendarWeek = { days: [] };

      for (let i = 0; i < 7; i++) {
        const date = new Date(currentDateIterator);
        // Use local date formatting to maintain timezone context
        const dateStr = date.getFullYear() + '-' + 
          String(date.getMonth() + 1).padStart(2, '0') + '-' +
          String(date.getDate()).padStart(2, '0');
        
        // Also convert event date to local format for proper comparison
        const dayEvents = events.filter((e) => {
          const eventDate = new Date(e.startDateTime);
          const eventDateStr = eventDate.getFullYear() + '-' +
            String(eventDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(eventDate.getDate()).padStart(2, '0');
          return eventDateStr === dateStr;
        });

        week.days.push({
          date,
          isCurrentMonth: date.getMonth() === month,
          events: dayEvents,
        });

        currentDateIterator.setDate(currentDateIterator.getDate() + 1);
      }

      weeks.push(week);
    }

    return weeks;
  };

  const handleCreateFixture = async () => {
    if (
      !fixtureData.title ||
      !fixtureData.startDateTime ||
      !fixtureData.endDateTime
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const payload: ICreateFixturePayload = {
        title: fixtureData.title,
        description: fixtureData.description || undefined,
        startDateTime: fixtureData.startDateTime,
        endDateTime: fixtureData.endDateTime,
        isAllDay: fixtureData.isAllDay,
      };

      await createPersonalFixture(payload);
      toast.success("Event created successfully");
      setShowFixtureDialog(false);
      setFixtureData({
        title: "",
        description: "",
        startDateTime: "",
        endDateTime: "",
        isAllDay: false,
      });
      loadEvents();
    } catch (error) {
      toast.error("Failed to create event");
      console.error(error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setDeletingEventId(eventId);
    try {
      if (eventId.startsWith("fixture-")) {
        const fixtureId = parseInt(eventId.split("-")[1]);
        await deletePersonalFixture(fixtureId);
        toast.success("Event deleted successfully");
      } else if (eventId.startsWith("notice-")) {
        const noticeId = parseInt(eventId.split("-")[1]);
        await deleteNotice(noticeId);
        toast.success("Notice deleted successfully");
      }
      loadEvents();
    } catch (error) {
      toast.error("Failed to delete event");
      console.error(error);
    } finally {
      setDeletingEventId(null);
    }
  };

  const openFixtureDialog = (date: Date) => {
    const dateStr = formatLocalDate(date);
    setFixtureData((prev) => ({
      ...prev,
      startDateTime: `${dateStr}T08:00`,
      endDateTime: `${dateStr}T09:00`,
    }));
    setShowFixtureDialog(true);
  };

  const viewDateDetails = (date: Date) => {
    setSelectedDate(date);
    setShowDateDetailsDialog(true);
  };

  const openFixtureDialogFromDateView = (date: Date) => {
    setShowDateDetailsDialog(false);
    openFixtureDialog(date);
  };

  const getEventColor = (type: ICalendarEvent["type"]) => {
    switch (type) {
      case "notice":
        return "bg-blue-100 text-blue-800 border-l-2 border-l-blue-500";
      case "routine":
        return "bg-purple-100 text-purple-800 border-l-2 border-l-purple-500";
      case "personal":
        return "bg-green-100 text-green-800 border-l-2 border-l-green-500";
      default:
        return "bg-gray-100 text-gray-800 border-l-2 border-l-gray-500";
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const weeks = generateCalendarWeeks();
  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">{monthName}</p>
        </div>

        <Dialog open={showFixtureDialog} onOpenChange={setShowFixtureDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Personal Event</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Event title"
                  value={fixtureData.title}
                  onChange={(e) =>
                    setFixtureData({ ...fixtureData, title: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description"
                  value={fixtureData.description}
                  onChange={(e) =>
                    setFixtureData({
                      ...fixtureData,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDateTime">Start Date/Time *</Label>
                  <Input
                    id="startDateTime"
                    type="datetime-local"
                    value={fixtureData.startDateTime}
                    onChange={(e) =>
                      setFixtureData({
                        ...fixtureData,
                        startDateTime: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="endDateTime">End Date/Time *</Label>
                  <Input
                    id="endDateTime"
                    type="datetime-local"
                    value={fixtureData.endDateTime}
                    onChange={(e) =>
                      setFixtureData({
                        ...fixtureData,
                        endDateTime: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAllDay"
                  checked={fixtureData.isAllDay}
                  onChange={(e) =>
                    setFixtureData({
                      ...fixtureData,
                      isAllDay: e.target.checked,
                    })
                  }
                />
                <Label htmlFor="isAllDay" className="cursor-pointer">
                  All day event
                </Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowFixtureDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateFixture} className="flex-1">
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Date Details Dialog */}
      <Dialog open={showDateDetailsDialog} onOpenChange={setShowDateDetailsDialog}>
        <DialogContent className="sm:max-w-md max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate?.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedDate && events
              .filter((e) => {
                const eventDateStr = formatLocalDate(new Date(e.startDateTime));
                const selectedDateStr = formatLocalDate(selectedDate);
                return eventDateStr === selectedDateStr;
              })
              .length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No events on this date</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDate &&
                  events
                    .filter((e) => {
                      const eventDateStr = formatLocalDate(new Date(e.startDateTime));
                      const selectedDateStr = formatLocalDate(selectedDate);
                      return eventDateStr === selectedDateStr;
                    })
                    .map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg ${getEventColor(event.type)}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="text-xs font-semibold mb-1 opacity-75">
                              {event.type.toUpperCase()}
                            </div>
                            <h4 className="font-semibold">{event.title}</h4>
                            {event.description && (
                              <p className="text-sm mt-1 opacity-90">
                                {event.description}
                              </p>
                            )}
                            {event.type === "notice" && event.metadata?.noticeContent && (
                              <p className="text-sm mt-1 opacity-90">
                                {event.metadata.noticeContent}
                              </p>
                            )}
                            {!event.isAllDay && (
                              <div className="text-xs mt-2 opacity-75">
                                {formatTime(event.startDateTime)}
                                {event.endDateTime &&
                                  ` - ${formatTime(event.endDateTime)}`}
                              </div>
                            )}
                            {event.isAllDay && (
                              <div className="text-xs mt-2 opacity-75">
                                All day
                              </div>
                            )}
                            {event.startTime && event.endTime && (
                              <div className="text-xs mt-2 opacity-75 bg-white/30 rounded px-2 py-1">
                                <span className="font-medium">Time: </span>
                                {event.startTime} - {event.endTime}
                              </div>
                            )}
                            {event.metadata?.confidence !== undefined && (
                              <div className="text-xs mt-1 opacity-75">
                                Confidence: {Math.round(event.metadata.confidence * 100)}%
                              </div>
                            )}
                          </div>
                          {((event.type === "personal") ||
                            (event.type === "notice" && event.metadata?.canDelete)) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEvent(event.id)}
                              disabled={deletingEventId === event.id}
                              className="text-red-500 hover:text-red-700 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
              </div>
            )}

            <Button
              onClick={() => openFixtureDialogFromDateView(selectedDate!)}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Month Navigation */}
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() - 1);
            setCurrentDate(newDate);
          }}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <h2 className="text-xl font-semibold">{monthName}</h2>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const newDate = new Date(currentDate);
            newDate.setMonth(newDate.getMonth() + 1);
            setCurrentDate(newDate);
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-0 border-b bg-gray-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-3 text-center font-semibold text-gray-700"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-0 border-b">
            {week.days.map((day, dayIdx) => {
              const isToday =
                new Date().toDateString() === day.date.toDateString();
              const isCurrentMonth = day.isCurrentMonth;

              return (
                <div
                  key={dayIdx}
                  onClick={() => viewDateDetails(day.date)}
                  className={`min-h-24 p-2 border-r cursor-pointer transition-colors hover:bg-blue-50 ${
                    isCurrentMonth ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <div
                    className={`text-sm font-semibold mb-1 ${
                      isToday
                        ? "bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center"
                        : isCurrentMonth
                        ? "text-gray-900"
                        : "text-gray-400"
                    }`}
                  >
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {day.events.slice(0, 4).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded truncate ${getEventColor(
                          event.type
                        )}`}
                        title={`${event.title}${event.startTime ? ` - ${event.startTime}${event.endTime ? ` to ${event.endTime}` : ''}` : ''}`}
                      >
                        <span className="font-medium">{event.title}</span>
                        {event.startTime && (
                          <span className="text-xs block opacity-75">
                            {event.startTime}
                            {event.endTime && ` - ${event.endTime}`}
                          </span>
                        )}
                      </div>
                    ))}
                    {day.events.length > 4 && (
                      <div className="text-xs text-gray-600 px-1">
                        +{day.events.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-6 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-sm text-gray-600">Notices</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded" />
          <span className="text-sm text-gray-600">Routines</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-sm text-gray-600">Personal Events</span>
        </div>
      </div>
    </div>
  );
}