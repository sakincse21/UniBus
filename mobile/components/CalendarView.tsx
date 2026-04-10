import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCalendarStore } from "@/store/calendarStore";
import { ICalendarEvent } from "@/interfaces";
import EventCard from "./EventCard";
import CreateEventModal from "./CreateEventModal";

interface CalendarViewProps {
  daysToShow?: number;
}

const CalendarView: React.FC<CalendarViewProps> = ({ daysToShow = 30 }) => {
  const insets = useSafeAreaInsets();
  const {
    events,
    isLoading,
    error,
    fetchCalendarEvents,
    deleteFixture,
    deleteNotice,
  } = useCalendarStore();
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
  const eventsByDate = events.reduce(
    (acc, event) => {
      try {
        const dateKey = new Date(event.startDateTime)
          .toISOString()
          .split("T")[0];
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(event);
      } catch {
        console.warn("Invalid date for event:", event);
      }
      return acc;
    },
    {} as Record<string, ICalendarEvent[]>,
  );

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort();

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 border-b border-gray-100">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-3xl font-bold text-gray-900">Calendar</Text>
            <Text className="text-gray-500 text-sm font-medium mt-1">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            className="bg-blue-600 rounded-lg px-3 py-2.5 active:bg-blue-700"
            onPress={() => {
              setSelectedDate(new Date());
              setCreateModalVisible(true);
            }}
          >
            <Text className="text-white text-lg font-semibold">+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error message */}
      {error && (
        <View className="bg-red-100 border border-red-300 rounded-lg mx-4 mt-4 p-3">
          <Text className="text-red-600 text-sm font-medium">{error}</Text>
        </View>
      )}

      {/* Loading state */}
      {isLoading && events.length === 0 && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}

      {/* Events list */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: 32,
        }}
      >
        {sortedDates.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-5xl mb-3">🗓️</Text>
            <Text className="text-gray-900 text-lg font-semibold">
              No events
            </Text>
            <Text className="text-gray-500 text-sm mt-2">
              Add an event to get started
            </Text>
          </View>
        ) : (
          sortedDates.map((dateKey) => {
            const date = new Date(dateKey);
            const dayName = date.toLocaleDateString("en-US", {
              weekday: "short",
            });
            const monthDay = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const isToday = new Date().toISOString().split("T")[0] === dateKey;

            return (
              <View key={dateKey} className="mb-5">
                {/* Date Header */}
                <TouchableOpacity
                  className={`flex-row items-center gap-3 mb-3 p-3 rounded-lg ${
                    isToday
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                  onPress={() => {
                    setSelectedDate(date);
                    setCreateModalVisible(true);
                  }}
                >
                  <View
                    className={`rounded-lg px-3 py-2 min-w-[50px] justify-center items-center ${
                      isToday ? "bg-blue-600" : "bg-gray-600"
                    }`}
                  >
                    <Text
                      className={`${isToday ? "text-white" : "text-white"} font-bold text-xs`}
                    >
                      {dayName}
                    </Text>
                    <Text className="text-white font-bold text-sm">
                      {monthDay.split(" ")[1]}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900">
                      {eventsByDate[dateKey].length} event
                      {eventsByDate[dateKey].length !== 1 ? "s" : ""}
                    </Text>
                    {isToday && (
                      <Text className="text-xs text-blue-600 font-medium">
                        Today
                      </Text>
                    )}
                  </View>
                  <Text className="text-gray-400 text-lg font-bold">+</Text>
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
          })
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
