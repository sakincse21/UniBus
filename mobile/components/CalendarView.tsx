import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCalendarStore } from "@/store/calendarStore";
import { ICalendarEvent } from "@/interfaces";
import EventCard from "./EventCard";
import CreateEventModal from "./CreateEventModal";

interface CalendarViewProps {
  daysToShow?: number;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarEvents(daysToShow);
  }, [daysToShow]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCalendarEvents(daysToShow);
    setRefreshing(false);
  }, [daysToShow]);

  // Get days in current month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Get first day of month (0-6, where 0 is Sunday)
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
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

  // Get selected date events
  const selectedDateKey = selectedDate.toISOString().split("T")[0];
  const selectedDateEvents = eventsByDate[selectedDateKey] || [];

  // Generate calendar days array
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days: (number | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

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

  const handleDayPress = (day: number | null) => {
    if (day) {
      const newDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day,
      );
      setSelectedDate(newDate);
    }
  };

  const isDateSelected = (day: number | null) => {
    if (!day) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return (
      date.toISOString().split("T")[0] ===
      selectedDate.toISOString().split("T")[0]
    );
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return (
      date.toISOString().split("T")[0] === today.toISOString().split("T")[0]
    );
  };

  const dayHasEvents = (day: number | null) => {
    if (!day) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const dateKey = date.toISOString().split("T")[0];
    return eventsByDate[dateKey] && eventsByDate[dateKey].length > 0;
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 20,
        }}
      >
        {/* Month Header and Navigation */}
        <View
          className="px-4 pt-4 pb-4 bg-white border-b border-gray-100"
          style={{ paddingTop: insets.top + 16 }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              {MONTH_NAMES[currentMonth.getMonth()]}{" "}
              {currentMonth.getFullYear()}
            </Text>
            <TouchableOpacity
              className="flex-row items-center gap-2 bg-blue-600 rounded-lg px-3 py-2 active:bg-blue-700"
              onPress={() => {
                setCreateModalVisible(true);
              }}
            >
              <Text className="text-white text-lg font-semibold">+</Text>
              <Text className="text-white text-xs font-semibold">Event</Text>
            </TouchableOpacity>
          </View>

          {/* Month Navigation */}
          <View className="flex-row justify-between items-center gap-3">
            <TouchableOpacity
              className="flex-row items-center justify-center w-10 h-10 rounded-lg bg-gray-100 active:bg-gray-200"
              onPress={handlePrevMonth}
            >
              <Text className="text-xl">‹</Text>
            </TouchableOpacity>

            <View className="flex-1 flex-row justify-center gap-2">
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-lg ${
                  viewMode === "month" ? "bg-blue-600" : "bg-gray-100"
                }`}
                onPress={() => setViewMode("month")}
              >
                <Text
                  className={`text-xs font-semibold ${
                    viewMode === "month" ? "text-white" : "text-gray-700"
                  }`}
                >
                  Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-lg ${
                  viewMode === "list" ? "bg-blue-600" : "bg-gray-100"
                }`}
                onPress={() => setViewMode("list")}
              >
                <Text
                  className={`text-xs font-semibold ${
                    viewMode === "list" ? "text-white" : "text-gray-700"
                  }`}
                >
                  List
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="flex-row items-center justify-center w-10 h-10 rounded-lg bg-gray-100 active:bg-gray-200"
              onPress={handleNextMonth}
            >
              <Text className="text-xl">›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View className="bg-red-100 border border-red-300 rounded-lg mx-4 mt-4 p-3">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        )}

        {/* Calendar Grid or List View */}
        {isLoading && events.length === 0 ? (
          <View className="flex-1 justify-center items-center py-16">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : viewMode === "month" ? (
          // Month View
          <View className="px-4 pt-4">
            {/* Day Headers */}
            <View className="flex-row mb-2 gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <View key={day} className="flex-1 items-center py-2">
                  <Text className="text-xs font-semibold text-gray-600">
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Days */}
            <View className="gap-1">
              {Array.from({
                length: Math.ceil(calendarDays.length / 7),
              }).map((_, weekIndex) => (
                <View key={weekIndex} className="flex-row gap-1">
                  {calendarDays
                    .slice(weekIndex * 7, (weekIndex + 1) * 7)
                    .map((day, dayIndex) => (
                      <TouchableOpacity
                        key={`${weekIndex}-${dayIndex}`}
                        className={`flex-1 aspect-square rounded-lg items-center justify-center border ${
                          day === null
                            ? "bg-white border-transparent"
                            : isDateSelected(day)
                              ? "bg-blue-600 border-blue-600"
                              : isToday(day)
                                ? "bg-blue-50 border-blue-300"
                                : dayHasEvents(day)
                                  ? "bg-green-50 border-green-200"
                                  : "bg-gray-50 border-gray-200"
                        }`}
                        onPress={() => handleDayPress(day)}
                      >
                        {day !== null && (
                          <View className="items-center justify-center w-full h-full">
                            <Text
                              className={`text-sm font-bold ${
                                isDateSelected(day)
                                  ? "text-white"
                                  : isToday(day)
                                    ? "text-blue-600"
                                    : "text-gray-900"
                              }`}
                            >
                              {day}
                            </Text>
                            {dayHasEvents(day) && !isDateSelected(day) && (
                              <View className="w-1.5 h-1.5 bg-green-600 rounded-full mt-0.5" />
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                </View>
              ))}
            </View>
          </View>
        ) : (
          // List View
          <View className="px-4 pt-4">
            {Object.keys(eventsByDate)
              .sort()
              .map((dateKey) => {
                const date = new Date(dateKey);
                const dayName = date.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const monthDay = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                const isToday_ =
                  new Date().toISOString().split("T")[0] === dateKey;

                return (
                  <View key={dateKey} className="mb-5">
                    {/* Date Header */}
                    <TouchableOpacity
                      className={`flex-row items-center gap-3 mb-3 p-3 rounded-lg ${
                        isToday_
                          ? "bg-blue-50 border border-blue-200"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                      onPress={() => {
                        setSelectedDate(date);
                      }}
                    >
                      <View
                        className={`rounded-lg px-3 py-2 min-w-[50px] justify-center items-center ${
                          isToday_ ? "bg-blue-600" : "bg-gray-600"
                        }`}
                      >
                        <Text className="text-white font-bold text-xs">
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
                        {isToday_ && (
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
              })}
          </View>
        )}

        {/* Selected Date Events - Bottom Section */}
        {viewMode === "month" && (
          <View className="px-4 pt-6 border-t border-gray-200 mt-6">
            <View className="mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-1">
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Text className="text-sm text-gray-500">
                {selectedDateEvents.length} event
                {selectedDateEvents.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {selectedDateEvents.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-4xl mb-2">📭</Text>
                <Text className="text-gray-600 text-sm">
                  No events on this day
                </Text>
              </View>
            ) : (
              selectedDateEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onDelete={() => handleDeleteEvent(event)}
                  isDeleting={deletingEventId === event.id}
                />
              ))
            )}
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
