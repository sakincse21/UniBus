import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useCalendarStore } from "@/store/calendarStore";
import { ICalendarEvent } from "@/interfaces";
import EventCard from "./EventCard";
import CreateEventModal from "./CreateEventModal";

interface CalendarViewProps {
  daysToShow?: number;
}

const CalendarView: React.FC<CalendarViewProps> = ({ daysToShow = 30 }) => {
  const { events, isLoading, error, fetchCalendarEvents, deleteFixture, deleteNotice } = useCalendarStore();
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarEvents(daysToShow);
  }, [daysToShow]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCalendarEvents(daysToShow);
    setRefreshing(false);
  }, [daysToShow]);

  const handleDeleteEvent = async (event: ICalendarEvent) => {
    setDeletingEventId(event.id);
    try {
      if (event.type === "personal" && event.source.fixtureId) {
        await deleteFixture(event.source.fixtureId);
      } else if (event.type === "notice" && event.source.noticeId) {
        await deleteNotice(event.source.noticeId);
      }
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleCreateEvent = async (data: any) => {
    const { createFixture } = useCalendarStore.getState();
    try {
      await createFixture(data);
    } catch (error) {
      console.error("Create error:", error);
    }
  };

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    try {
      const dateKey = new Date(event.startDateTime).toISOString().split("T")[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
    } catch {
      console.warn("Invalid date for event:", event);
    }
    return acc;
  }, {} as Record<string, ICalendarEvent[]>);

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort();

  return (
    <View className="flex-1 bg-white">
      {/* Header with create button */}
      <View className="px-4 py-4 flex-row justify-between items-center border-b border-gray-200">
        <Text className="text-xl font-bold">Calendar</Text>
        <TouchableOpacity
          className="bg-blue-500 rounded-full w-12 h-12 justify-center items-center"
          onPress={() => {
            setSelectedDate(new Date());
            setCreateModalVisible(true);
          }}
        >
          <Text className="text-white text-xl font-bold">+</Text>
        </TouchableOpacity>
      </View>

      {/* Error message */}
      {error && (
        <View className="bg-red-100 border border-red-300 rounded-lg mx-4 mt-4 p-3">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      )}

      {/* Loading state */}
      {isLoading && events.length === 0 && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* Events list */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {sortedDates.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-gray-500">No events found</Text>
          </View>
        ) : (
          <View className="px-4 py-4 pb-20">
            {sortedDates.map((dateKey) => {
              const date = new Date(dateKey);
              const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
              const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

              return (
                <View key={dateKey} className="mb-6">
                  {/* Date Header */}
                  <TouchableOpacity
                    className="flex-row items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg"
                    onPress={() => {
                      setSelectedDate(date);
                      setCreateModalVisible(true);
                    }}
                  >
                    <View className="bg-blue-500 rounded-lg px-3 py-2 min-w-[50px] justify-center items-center">
                      <Text className="text-white font-bold text-xs">{dayName}</Text>
                      <Text className="text-white font-bold">{monthDay}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-gray-600">
                        {eventsByDate[dateKey].length} event
                        {eventsByDate[dateKey].length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Text className="text-gray-400 text-lg">+</Text>
                  </TouchableOpacity>

                  {/* Events for this date */}
                  {eventsByDate[dateKey].map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onDelete={() => handleDeleteEvent(event)}
                      isDeleting={deletingEventId === event.id}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Event Modal */}
      <CreateEventModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateEvent}
        initialDate={selectedDate}
      />
    </View>
  );
};

export default CalendarView;
