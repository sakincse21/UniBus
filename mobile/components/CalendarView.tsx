import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCalendarStore } from "@/store/calendarStore";
import { ICalendarEvent } from "@/interfaces";
import EventCard from "@/components/EventCard";
import CreateEventModal from "@/components/CreateEventModal";
import { silentRemoveEventFromCalendar } from "@/lib/calendar";
import {
  formatBangladesh,
  formatBangladeshMonthYear,
  getBangladeshDateKey,
  parseApiDate,
} from "@/lib/dateFormatter";
import { APP_THEME_COLORS } from "@/lib/theme";

interface CalendarViewProps {
  daysToShow?: number;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLORS = {
  ...APP_THEME_COLORS,
  dangerText: APP_THEME_COLORS.danger,
};

type ActionButtonVariant = "primary" | "soft";

function ActionButton({
  label,
  onPress,
  icon,
  disabled = false,
  compact = false,
  variant = "soft",
  containerStyle,
}: {
  label?: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  compact?: boolean;
  variant?: ActionButtonVariant;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const variantMap: Record<
    ActionButtonVariant,
    { backgroundColor: string; borderColor: string; textColor: string; iconBg: string }
  > = {
    primary: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
      textColor: "#FFFFFF",
      iconBg: "rgba(255, 255, 255, 0.18)",
    },
    soft: {
      backgroundColor: COLORS.surface,
      borderColor: COLORS.outline,
      textColor: COLORS.onSurface,
      iconBg: COLORS.surfaceLow,
    },
  };

  const theme = variantMap[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.86}
      style={[
        {
          backgroundColor: theme.backgroundColor,
          borderWidth: 1,
          borderColor: theme.borderColor,
          borderRadius: 10,
          paddingHorizontal: compact ? 11 : 14,
          minHeight: compact ? 36 : 44,
          justifyContent: "center",
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: variant === "primary" ? 0.12 : 0.07,
          shadowRadius: 3,
          elevation: 1,
        },
        disabled ? { opacity: 0.55 } : null,
        containerStyle,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {icon ? (
          <View
            style={{
              width: compact ? 19 : 21,
              height: compact ? 19 : 21,
              borderRadius: 999,
              backgroundColor: theme.iconBg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: label ? 8 : 0,
            }}
          >
            {icon}
          </View>
        ) : null}

        {label ? (
          <Text
            style={{
              color: theme.textColor,
              fontSize: compact ? 14 : 15,
              fontWeight: "700",
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const fabBottomOffset = insets.bottom;

  useEffect(() => {
    fetchCalendarEvents(daysToShow);
  }, [daysToShow, fetchCalendarEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCalendarEvents(daysToShow);
    setRefreshing(false);
  }, [daysToShow, fetchCalendarEvents]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const eventsByDate = events.reduce(
    (acc, event) => {
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

  const dateKeys = Object.keys(eventsByDate).sort();
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

    // Keep a strict 7-column grid so rows occupy full width.
    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const handleDeleteEvent = async (event: ICalendarEvent) => {
    setDeletingEventId(event.id);
    try {
      if ((event.type === "personal" || event.type === "public") && event.source.fixtureId) {
        await deleteFixture(event.source.fixtureId);
        await silentRemoveEventFromCalendar(event.id);
      } else if (event.type === "notice" && event.source.noticeId) {
        await deleteNotice(event.source.noticeId);
      }
    } catch (deleteError) {
      console.error("Delete error:", deleteError);
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleCreateEvent = async (data: any) => {
    const { createFixture } = useCalendarStore.getState();
    try {
      await createFixture(data);
      setCreateModalVisible(false);
    } catch (createError) {
      console.error("Create error:", createError);
    }
  };

  const handleDayPress = (day: number | null) => {
    if (!day) return;

    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    setSelectedDate(newDate);
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

  const getEventDotColor = (event: ICalendarEvent): string => {
    switch (event.type) {
      case "notice":
        return "#0053DC";
      case "personal":
        return "#0D7A43";
      case "public":
        return "#B45309";
      default:
        return "#6B7280";
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

    return (eventsByDate[dateKey]?.length || 0) > 0;
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
    const colors = dayEvents.map((event) => getEventDotColor(event));

    return [...new Set(colors)];
  };

  const legendItems = [
    { label: "Notice", color: "#0053DC" },
    { label: "Personal", color: "#0D7A43" },
    { label: "Public", color: "#B45309" },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
      <View className="px-4 pb-4" style={{ paddingTop: insets.top + 14 }}>
        <View
          className="rounded-xl p-4"
          style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
        >
          <View className="mb-4">
            <View className="pr-3">
              <Text className="text-3xl font-extrabold" style={{ color: COLORS.onSurface }}>
                Calendar
              </Text>
              <Text className="text-base mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                {formatBangladeshMonthYear(currentMonth)}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center gap-2">
            <ActionButton
              onPress={handlePrevMonth}
              compact
              variant="soft"
              icon={<Feather name="chevron-left" size={14} color={COLORS.onSurface} />}
              containerStyle={{ width: 42 }}
            />

            <View className="flex-1 flex-row justify-center gap-2">
              <ActionButton
                label="Month"
                onPress={() => setViewMode("month")}
                compact
                variant={viewMode === "month" ? "primary" : "soft"}
                icon={
                  <Ionicons
                    name="calendar-outline"
                    size={12}
                    color={viewMode === "month" ? "#FFFFFF" : COLORS.onSurface}
                  />
                }
              />

              <ActionButton
                label="List"
                onPress={() => setViewMode("list")}
                compact
                variant={viewMode === "list" ? "primary" : "soft"}
                icon={
                  <Ionicons
                    name="list-outline"
                    size={12}
                    color={viewMode === "list" ? "#FFFFFF" : COLORS.onSurface}
                  />
                }
              />
            </View>

            <ActionButton
              onPress={handleNextMonth}
              compact
              variant="soft"
              icon={<Feather name="chevron-right" size={14} color={COLORS.onSurface} />}
              containerStyle={{ width: 42 }}
            />
          </View>

          <View className="flex-row items-center mt-3 gap-4">
            {legendItems.map((item) => (
              <View key={item.label} className="flex-row items-center gap-1.5">
                <View
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <Text className="text-xs font-semibold" style={{ color: COLORS.onSurfaceMuted }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {error && (
        <View
          className="rounded-xl p-3 mx-4 mb-3"
          style={{ backgroundColor: COLORS.dangerSoft, borderWidth: 1, borderColor: "#F6CACA" }}
        >
          <Text className="text-sm font-semibold" style={{ color: COLORS.dangerText }}>
            {error}
          </Text>
        </View>
      )}

      {isLoading && events.length === 0 ? (
        <View className="flex-1 justify-center items-center py-16">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <>
          {viewMode === "month" && (
            <View
              className="mx-4 mb-3 rounded-xl p-3"
              style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
            >
              <View className="flex-row mb-2" style={{ gap: 3 }}>
                {DAYS_OF_WEEK.map((day) => (
                  <View
                    key={day}
                    style={{ flex: 1, height: 28 }}
                    className="items-center justify-center"
                  >
                    <Text className="text-xs font-bold" style={{ color: COLORS.onSurfaceMuted }}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ gap: 3 }}>
                {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIndex) => (
                  <View key={weekIndex} className="flex-row" style={{ gap: 3 }}>
                    {calendarDays
                      .slice(weekIndex * 7, (weekIndex + 1) * 7)
                      .map((day, dayIndex) => {
                        const eventColors = getDayEventColors(day);
                        const selected = isDateSelected(day);
                        const today = isToday(day);
                        const hasEvents = dayHasEvents(day);

                        return (
                          <TouchableOpacity
                            key={`${weekIndex}-${dayIndex}`}
                            style={{ flex: 1, aspectRatio: 1 }}
                            className="items-center justify-center overflow-hidden"
                            onPress={() => handleDayPress(day)}
                            disabled={day === null}
                            activeOpacity={0.85}
                          >
                            {day === null ? (
                              <View
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: 10,
                                }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: selected
                                    ? COLORS.primary
                                    : today
                                      ? "#9FC1FF"
                                      : COLORS.outline,
                                  backgroundColor: selected
                                    ? COLORS.primary
                                    : today
                                      ? COLORS.primarySoft
                                      : COLORS.surfaceLow,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  paddingHorizontal: 2,
                                }}
                              >
                                <Text
                                  className="text-sm font-bold"
                                  style={{
                                    color: selected
                                      ? "#FFFFFF"
                                      : today
                                        ? COLORS.primary
                                        : COLORS.onSurface,
                                  }}
                                  numberOfLines={1}
                                >
                                  {day}
                                </Text>

                                {hasEvents && !selected && (
                                  <View className="flex-row mt-0.5" style={{ gap: 2 }}>
                                    {eventColors.slice(0, 3).map((color, idx) => (
                                      <View
                                        key={`${day}-${idx}`}
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: color }}
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
                ))}
              </View>
            </View>
          )}

          <ScrollView
            className="flex-1"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 2,
              paddingBottom: insets.bottom + 120,
            }}
          >
            {viewMode === "list" && (
              <View>
                {dateKeys.length === 0 ? (
                  <View
                    className="rounded-xl p-6 items-center"
                    style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
                  >
                    <Text className="text-base font-bold" style={{ color: COLORS.onSurface }}>
                      No upcoming events
                    </Text>
                    <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                      Create a personal or public event to get started.
                    </Text>

                    <View className="mt-4 w-full">
                      <ActionButton
                        label="Create Event"
                        onPress={() => setCreateModalVisible(true)}
                        variant="primary"
                        icon={<Feather name="plus" size={16} color="#FFFFFF" />}
                      />
                    </View>
                  </View>
                ) : (
                  dateKeys.map((dateKey) => {
                    const date = parseApiDate(dateKey);
                    const dayName = formatBangladesh(date, {
                      weekday: "short",
                    });
                    const monthDay = formatBangladesh(date, {
                      month: "short",
                      day: "numeric",
                    });
                    const dayNumber = formatBangladesh(date, {
                      day: "numeric",
                    });
                    const isToday_ = getBangladeshDateKey(new Date()) === dateKey;

                    return (
                      <View key={dateKey} className="mb-5">
                        <TouchableOpacity
                          className="flex-row items-center gap-3 mb-3 p-3 rounded-xl"
                          style={{
                            backgroundColor: COLORS.surface,
                            borderWidth: 1,
                            borderColor: isToday_ ? "#9FC1FF" : COLORS.outline,
                          }}
                          onPress={() => setSelectedDate(date)}
                          activeOpacity={0.86}
                        >
                          <View
                            className="rounded-lg px-3 py-2 min-w-[52px] items-center"
                            style={{ backgroundColor: isToday_ ? COLORS.primary : COLORS.onSurfaceMuted }}
                          >
                            <Text className="text-white font-bold text-xs">{dayName}</Text>
                            <Text className="text-white font-bold text-sm">{dayNumber}</Text>
                          </View>

                          <View className="flex-1">
                            <Text className="text-base font-bold" style={{ color: COLORS.onSurface }}>
                              {eventsByDate[dateKey].length} event
                              {eventsByDate[dateKey].length !== 1 ? "s" : ""}
                            </Text>
                            <Text className="text-sm" style={{ color: COLORS.onSurfaceMuted }}>
                              {monthDay}
                            </Text>
                            {isToday_ && (
                              <Text className="text-xs font-semibold mt-0.5" style={{ color: COLORS.primary }}>
                                Today
                              </Text>
                            )}
                          </View>

                          <Feather name="chevron-right" size={16} color={COLORS.onSurfaceMuted} />
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
                  })
                )}
              </View>
            )}

            {viewMode === "month" && (
              <View
                className="rounded-xl p-4"
                style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
              >
                <View className="mb-4 flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-2xl font-extrabold" style={{ color: COLORS.onSurface }}>
                      {formatBangladesh(selectedDate, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                    <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                      Events scheduled for this day
                    </Text>
                  </View>

                  <View
                    className="px-3 py-1 rounded-lg"
                    style={{
                      backgroundColor:
                        selectedDateEvents.length > 0 ? COLORS.primarySoft : COLORS.surfaceLow,
                      borderWidth: 1,
                      borderColor: COLORS.outline,
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{
                        color: selectedDateEvents.length > 0 ? COLORS.primary : COLORS.onSurfaceMuted,
                      }}
                    >
                      {selectedDateEvents.length} event
                      {selectedDateEvents.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>

                {selectedDateEvents.length === 0 ? (
                  <View
                    className="items-center justify-center py-10 rounded-lg"
                    style={{
                      backgroundColor: COLORS.surfaceLow,
                      borderWidth: 1,
                      borderColor: COLORS.outline,
                      borderStyle: "dashed",
                    }}
                  >
                    <Ionicons name="calendar-clear-outline" size={26} color={COLORS.onSurfaceMuted} />
                    <Text className="text-base font-semibold mt-2" style={{ color: COLORS.onSurface }}>
                      No events on this day
                    </Text>
                    <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                      Add a personal or public event in one tap.
                    </Text>

                    <View className="mt-4 w-full px-5">
                      <ActionButton
                        label="Add Event"
                        onPress={() => setCreateModalVisible(true)}
                        variant="primary"
                        icon={<Feather name="plus" size={16} color="#FFFFFF" />}
                      />
                    </View>
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
        </>
      )}

      <CreateEventModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateEvent}
        initialDate={selectedDate}
      />

      <TouchableOpacity
        onPress={() => setCreateModalVisible(true)}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Add event"
        style={{
          position: "absolute",
          right: 16,
          bottom: fabBottomOffset,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.primary,
          borderWidth: 1,
          borderColor: COLORS.primary,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 7,
        }}
      >
        <Feather name="plus" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

export default CalendarView;
