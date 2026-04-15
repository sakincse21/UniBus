import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCalendarStore } from "@/store/calendarStore";
import { ICalendarEvent } from "@/interfaces";
import EventCard from "./EventCard";
import CreateEventModal from "./CreateEventModal";
import { silentRemoveEventFromCalendar } from "@/lib/calendar";
import {
  formatBangladesh,
  formatBangladeshMonthYear,
  getBangladeshDateKey,
  parseApiDate,
} from "@/lib/dateFormatter";

interface CalendarViewProps {
  daysToShow?: number;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CalendarView: React.FC<CalendarViewProps> = ({ daysToShow = 30 }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  
  // Calculate cell size based on screen width
  // screenWidth - padding (32px) - gaps (24px for 6 gaps of 4px) / 7 cells
  const cellSize = Math.floor((screenWidth - 32 - 24) / 7);
  
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

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const eventsByDate = events.reduce(
    (acc, event) => {
      // Hide routine from events globally in CalendarView
      if (event.type === "routine") return acc;

      try {
        const dateKey = getBangladeshDateKey(event.startDateTime);
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

  const selectedDateKey = getBangladeshDateKey(selectedDate);
  const selectedDateEvents = eventsByDate[selectedDateKey] || [];

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
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
        await silentRemoveEventFromCalendar(event.id);
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
      setCreateModalVisible(false);
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
    return getBangladeshDateKey(date) === getBangladeshDateKey(selectedDate);
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return getBangladeshDateKey(date) === getBangladeshDateKey(today);
  };

  const getEventDotColor = (event: ICalendarEvent) => {
    switch (event.type) {
      case "notice":
        return "bg-blue-500";
      case "routine":
        return "bg-purple-500";
      case "personal":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const dayHasEvents = (day: number | null) => {
    if (!day) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const dateKey = getBangladeshDateKey(date);
    return eventsByDate[dateKey] && eventsByDate[dateKey].length > 0;
  };

  const getDayEventColors = (day: number | null): string[] => {
    if (!day) return [];
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const dateKey = getBangladeshDateKey(date);
    const dayEvents = eventsByDate[dateKey] || [];
    const colors = dayEvents.map((event) => {
      switch (event.type) {
        case "notice":
          return "bg-blue-500";
        case "routine":
          return "bg-purple-500";
        case "personal":
          return "bg-green-500";
        default:
          return "bg-gray-500";
      }
    });
    return [...new Set(colors)];
  };

  return (
    <View className="flex-1 bg-white">
        <View
          className="px-4 pt-4 pb-4 bg-white border-b border-gray-100 shadow-sm z-10"
          style={{ paddingTop: insets.top + 16 }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              {formatBangladeshMonthYear(currentMonth)}
            </Text>
            <TouchableOpacity
              className="bg-blue-600 rounded-lg px-4 py-2"
              onPress={() => setCreateModalVisible(true)}
            >
              <Text className="text-white font-semibold">Add Event</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between items-center gap-3">
            <TouchableOpacity
              className="items-center justify-center w-10 h-10 rounded-lg bg-gray-100"
              onPress={handlePrevMonth}
            >
              <Text className="text-xl">‹</Text>
            </TouchableOpacity>

            <View className="flex-1 flex-row justify-center gap-2">
              <TouchableOpacity
                className={`px-4 py-2 rounded-lg ${viewMode === "month" ? "bg-blue-600" : "bg-gray-100"}`}
                onPress={() => setViewMode("month")}
              >
                <Text
                  className={`text-sm font-medium ${viewMode === "month" ? "text-white" : "text-gray-700"}`}
                >
                  Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-4 py-2 rounded-lg ${viewMode === "list" ? "bg-blue-600" : "bg-gray-100"}`}
                onPress={() => setViewMode("list")}
              >
                <Text
                  className={`text-sm font-medium ${viewMode === "list" ? "text-white" : "text-gray-700"}`}
                >
                  List
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="items-center justify-center w-10 h-10 rounded-lg bg-gray-100"
              onPress={handleNextMonth}
            >
              <Text className="text-xl">›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View className="bg-red-100 border border-red-300 rounded-lg mx-4 mt-4 p-3">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        )}

        {isLoading && events.length === 0 ? (
          <View className="flex-1 justify-center items-center py-16">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : viewMode === "month" && (
          <View className="px-4 pt-4 border-b border-gray-100 pb-4 z-0">
            <View className="flex-row mb-2 gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <View 
                  key={day} 
                  style={{ width: cellSize, height: cellSize }}
                  className="items-center justify-center"
                >
                  <Text className="text-xs font-semibold text-gray-600">
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            <View className="gap-1">
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map(
                (_, weekIndex) => (
                  <View key={weekIndex} className="flex-row gap-1">
                    {calendarDays
                      .slice(weekIndex * 7, (weekIndex + 1) * 7)
                      .map((day, dayIndex) => {
                        const eventColors = getDayEventColors(day);
                        return (
                          <TouchableOpacity
                            key={`${weekIndex}-${dayIndex}`}
                            style={{ width: cellSize, height: cellSize }}
                            className={`rounded-lg items-center justify-center border overflow-hidden ${
                              day === null
                                ? "bg-white border-transparent"
                                : isDateSelected(day)
                                  ? "bg-blue-600 border-blue-600"
                                  : isToday(day)
                                    ? "bg-blue-50 border-blue-300"
                                    : dayHasEvents(day)
                                      ? "bg-gray-50 border-gray-200"
                                      : "bg-gray-50 border-gray-200"
                            }`}
                            onPress={() => handleDayPress(day)}
                          >
                            {day !== null && (
                              <View className="items-center justify-center w-full h-full px-1">
                                <Text
                                  className={`text-sm font-bold ${
                                    isDateSelected(day)
                                      ? "text-white"
                                      : isToday(day)
                                        ? "text-blue-600"
                                        : "text-gray-900"
                                  }`}
                                  numberOfLines={1}
                                >
                                  {day}
                                </Text>
                                {eventColors.length > 0 &&
                                  !isDateSelected(day) && (
                                    <View className="flex-row gap-0.5 mt-0.5">
                                      {eventColors
                                        .slice(0, 3)
                                        .map((color, idx) => (
                                          <View
                                            key={idx}
                                            className={`w-1 h-1 rounded-full ${color}`}
                                          />
                                        ))}
                                    </View>
                                  )}
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                ),
              )}
            </View>
          </View>
        )}

      <ScrollView
        className="flex-1 px-4 z-0 bg-white"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 16 }}
      >
        {viewMode === "list" && (
          <View>
            {Object.keys(eventsByDate)
              .sort()
              .map((dateKey) => {
                const date = parseApiDate(dateKey);
                const dayName = formatBangladesh(date, {
                  weekday: "short",
                });
                const monthDay = formatBangladesh(date, {
                  month: "short",
                  day: "numeric",
                });
                const isToday_ = getBangladeshDateKey(new Date()) === dateKey;

                return (
                  <View key={dateKey} className="mb-5">
                    <TouchableOpacity
                      className={`flex-row items-center gap-3 mb-3 p-3 rounded-lg ${
                        isToday_
                          ? "bg-blue-50 border border-blue-200"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                      onPress={() => setSelectedDate(date)}
                    >
                      <View
                        className={`rounded-lg px-3 py-2 min-w-[50px] items-center ${isToday_ ? "bg-blue-600" : "bg-gray-600"}`}
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
                    </TouchableOpacity>

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

        {viewMode === "month" && (
          <View className="px-4 py-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-extrabold text-gray-900">
                {formatBangladesh(selectedDate, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <View className="bg-blue-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-bold text-blue-700">
                  {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {selectedDateEvents.length === 0 ? (
              <View className="items-center justify-center py-10 bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
                <Text className="text-gray-400 font-medium text-base">
                  No events on this day
                </Text>
                <TouchableOpacity onPress={() => setCreateModalVisible(true)} className="mt-3">
                    <Text className="text-blue-500 font-semibold text-sm">Add one now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {selectedDateEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={() => handleDeleteEvent(event)}
                    isDeleting={deletingEventId === event.id}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

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
