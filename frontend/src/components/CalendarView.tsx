"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchCalendarEvents,
  createPersonalFixture,
  deletePersonalFixture,
} from "@/lib/action/calendar";
import { ICalendarEvent, ICreateFixturePayload } from "@/lib/interfaces";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, Clock, Trash2 } from "lucide-react";
import {
  formatBangladesh,
  formatBangladeshTime,
  getBangladeshDateKey,
  parseApiDate,
} from "@/lib/dateTime";

interface GroupedEvents {
  [date: string]: ICalendarEvent[];
}

export default function CalendarView() {
  const [events, setEvents] = useState<ICalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [showFixtureDialog, setShowFixtureDialog] = useState(false);
  const [fixtureData, setFixtureData] = useState({
    title: "",
    description: "",
    startDateTime: "",
    endDateTime: "",
    isAllDay: false,
    isPublic: false,
  });

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchCalendarEvents(days);
      if (result.success) {
        setEvents(result.data);
      }
    } catch (error) {
      toast.error("Failed to load calendar events");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const groupEventsByDate = (): GroupedEvents => {
    const grouped: GroupedEvents = {};

    events.forEach((event) => {
      const dateStr = getBangladeshDateKey(event.startDateTime);

      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(event);
    });

    return grouped;
  };

  const handleCreateFixture = async () => {
    if (!fixtureData.title || !fixtureData.startDateTime || !fixtureData.endDateTime) {
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
        isPublic: fixtureData.isPublic,
      };

      await createPersonalFixture(payload);
      toast.success("Fixture created successfully");
      setShowFixtureDialog(false);
      setFixtureData({
        title: "",
        description: "",
        startDateTime: "",
        endDateTime: "",
        isAllDay: false,
        isPublic: false,
      });
      loadEvents();
    } catch (error) {
      toast.error("Failed to create fixture");
      console.error(error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (eventId.startsWith("fixture-")) {
      const fixtureId = parseInt(eventId.split("-")[1]);
      try {
        await deletePersonalFixture(fixtureId);
        toast.success("Fixture deleted successfully");
        loadEvents();
      } catch (error) {
        toast.error("Failed to delete fixture");
        console.error(error);
      }
    }
  };

  const groupedEvents = groupEventsByDate();
  const sortedDates = Object.keys(groupedEvents).sort();

  const getEventColor = (type: ICalendarEvent["type"]) => {
    switch (type) {
      case "notice":
        return "border-l-4 border-l-blue-500 bg-blue-50";
      case "routine":
        return "border-l-4 border-l-purple-500 bg-purple-50";
      case "personal":
        return "border-l-4 border-l-green-500 bg-green-50";
      case "public":
        return "border-l-4 border-l-amber-500 bg-amber-50";
      default:
        return "border-l-4 border-l-gray-500 bg-gray-50";
    }
  };

  const getTypeLabel = (type: ICalendarEvent["type"]) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatTime = (dateStr: string) => {
    return formatBangladeshTime(dateStr);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
          <p>Loading calendar events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">
            Displaying events for the next {days} days
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={showFixtureDialog} onOpenChange={setShowFixtureDialog}>
            <DialogTrigger asChild>
              <Button>+ Add Event</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
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

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={fixtureData.isPublic}
                    onChange={(e) =>
                      setFixtureData({
                        ...fixtureData,
                        isPublic: e.target.checked,
                      })
                    }
                  />
                  <Label htmlFor="isPublic" className="cursor-pointer">
                    Public event (visible to all roles)
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
                  <Button
                    onClick={handleCreateFixture}
                    className="flex-1"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      {sortedDates.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No events scheduled</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const date = parseApiDate(dateStr);
            const dayName = formatBangladesh(date, {
              weekday: "long",
            });
            const formattedDate = formatBangladesh(date, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div key={dateStr}>
                <div className="sticky top-0 bg-white py-2 mb-3 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {dayName}, {formattedDate}
                  </h2>
                </div>

                <div className="space-y-2">
                  {groupedEvents[dateStr].map((event) => (
                    <Card
                      key={event.id}
                      className={`p-4 ${getEventColor(event.type)}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-600 bg-white px-2 py-1 rounded">
                              {getTypeLabel(event.type)}
                            </span>
                            {event.metadata?.batchName && (
                              <span className="text-xs text-gray-600">
                                Batch: {event.metadata.batchName}
                              </span>
                            )}
                          </div>

                          <h3 className="font-semibold text-gray-900 mb-1">
                            {event.title}
                          </h3>

                          {event.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {event.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {!event.isAllDay && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {formatTime(event.startDateTime)}
                                  {event.endDateTime &&
                                    ` - ${formatTime(event.endDateTime)}`}
                                </span>
                              </div>
                            )}

                            {event.startTime && event.endTime && (
                              <div className="flex items-center gap-1 text-xs bg-blue-50 px-2 py-1 rounded">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {event.startTime} - {event.endTime}
                                </span>
                              </div>
                            )}

                            {event.metadata?.confidence !== undefined && (
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-gray-500">Confidence:</span>
                                <span className="font-semibold">
                                  {Math.round(event.metadata.confidence * 100)}%
                                </span>
                              </div>
                            )}

                            {event.metadata?.note && (
                              <div className="text-xs text-gray-500">
                                {event.metadata.note}
                              </div>
                            )}
                          </div>
                        </div>

                        {(event.source.fixtureId &&
                          (event.metadata?.canDelete ?? event.type === "personal")) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
