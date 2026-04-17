import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRoutineStore } from "@/store/routineStore";
import { IRoutineSlot } from "@/interfaces";
import { scheduleWeeklyReminders, cancelAllReminders } from "@/lib/reminders";
import { syncRoutineToCalendar, clearSyncedRoutinesFromCalendar } from "@/lib/calendar";
import { APP_THEME_COLORS } from "@/lib/theme";

const COLORS = {
  ...APP_THEME_COLORS,
  secondary: "#506076",
  tertiary: "#685781",
  error: APP_THEME_COLORS.danger,
};

const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

const DAY_META: Record<string, { accent: string }> = {
  monday: { accent: COLORS.primary },
  tuesday: { accent: COLORS.tertiary },
  wednesday: { accent: COLORS.primary },
  thursday: { accent: COLORS.primary },
  friday: { accent: COLORS.secondary },
  saturday: { accent: "#6B7280" },
  sunday: { accent: "#6B7280" },
};

function dayIndex(day: string): number {
  const idx = DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number]);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function confidenceBadge(confidence: number): {
  backgroundColor: string;
  textColor: string;
  label: string;
} {
  if (confidence >= 0.8) {
    return {
      backgroundColor: "#E8F5EE",
      textColor: "#0D7A43",
      label: `${Math.round(confidence * 100)}% High`,
    };
  }

  if (confidence >= 0.5) {
    return {
      backgroundColor: "#FFF5DB",
      textColor: "#925C00",
      label: `${Math.round(confidence * 100)}% Medium`,
    };
  }

  return {
    backgroundColor: "#FBE7E7",
    textColor: "#9F2522",
    label: `${Math.round(confidence * 100)}% Low`,
  };
}

function parseRoutineTime(value: string): {
  hour: string;
  minute: string;
  period: "AM" | "PM" | "";
  full: string;
} {
  const raw = String(value || "").trim();
  if (!raw) {
    return { hour: "--", minute: "--", period: "", full: "--:--" };
  }

  const [hPart, mPart] = raw.split(":");
  const h = Number(hPart);
  const m = Number(mPart);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return { hour: "--", minute: "--", period: "", full: "--:--" };
  }

  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  const hour = String(hour12).padStart(2, "0");
  const minute = String(m).padStart(2, "0");

  return {
    hour,
    minute,
    period,
    full: `${hour}:${minute}`,
  };
}

function TimeBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const parsed = parseRoutineTime(value);

  return (
    <View className="flex-row items-start gap-4">
      <View className="w-16 items-center">
        <Text style={{ color: accent }} className="text-3xl font-extrabold leading-8">
          {parsed.hour}
        </Text>
        <Text className="text-xs font-bold text-gray-500 mt-0.5">{parsed.period}</Text>
      </View>

      <View className="flex-1 pt-0.5">
        <Text className="text-base font-bold" style={{ color: COLORS.onSurface }}>
          {label}
        </Text>
        <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
          Starts at {parsed.full}
        </Text>
      </View>
    </View>
  );
}

type ActionButtonVariant = "primary" | "soft" | "danger";

function ActionButton({
  label,
  onPress,
  icon,
  disabled = false,
  compact = false,
  variant = "soft",
  containerStyle,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  compact?: boolean;
  variant?: ActionButtonVariant;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const variantMap: Record<
    ActionButtonVariant,
    {
      backgroundColor: string;
      borderColor: string;
      textColor: string;
      iconBg: string;
      withShadow: boolean;
    }
  > = {
    primary: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
      textColor: "#FFFFFF",
      iconBg: "rgba(255,255,255,0.18)",
      withShadow: true,
    },
    soft: {
      backgroundColor: COLORS.surface,
      borderColor: COLORS.outline,
      textColor: COLORS.onSurface,
      iconBg: COLORS.surfaceLow,
      withShadow: true,
    },
    danger: {
      backgroundColor: "#FBE9E9",
      borderColor: "#F5C9C8",
      textColor: COLORS.error,
      iconBg: "#F7D9D9",
      withShadow: false,
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
          borderRadius: 12,
          paddingHorizontal: compact ? 12 : 14,
          minHeight: compact ? 38 : 46,
          justifyContent: "center",
        },
        theme.withShadow
          ? {
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.11,
              shadowRadius: 4,
              elevation: 2,
            }
          : null,
        disabled ? { opacity: 0.55 } : null,
        containerStyle,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {icon ? (
          <View
            style={{
              width: compact ? 20 : 22,
              height: compact ? 20 : 22,
              borderRadius: 999,
              backgroundColor: theme.iconBg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            {icon}
          </View>
        ) : null}
        <Text
          style={{
            color: theme.textColor,
            fontSize: compact ? 14 : 15,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SlotCard({
  slot,
  index,
  isDraft,
  onUpdate,
  onRemove,
}: {
  slot: IRoutineSlot;
  index: number;
  isDraft: boolean;
  onUpdate: (idx: number, patch: Partial<IRoutineSlot>) => void;
  onRemove?: (idx: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(slot.firstHalfStart);
  const [second, setSecond] = useState(slot.secondHalfStart);
  const [note, setNote] = useState(slot.note || "");
  const dayMeta = DAY_META[slot.day] || {
    accent: COLORS.primary,
  };
  const confidence = confidenceBadge(slot.confidence || 0);

  const applyEdit = () => {
    onUpdate(index, {
      firstHalfStart: first,
      secondHalfStart: second,
      note,
    });
    setEditing(false);
  };

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderColor: COLORS.outline,
        borderLeftColor: dayMeta.accent,
      }}
      className="rounded-xl border border-l-[5px] p-5 mb-4"
    >
      <View className="flex-row items-start justify-between mb-5">
        <View className="flex-1 pr-3">
          <Text className="text-2xl font-extrabold" style={{ color: COLORS.onSurface }}>
            {DAY_LABELS[slot.day] || slot.day}
          </Text>
        </View>

        <View className="items-end">
          {isDraft ? (
            <View
              style={{ backgroundColor: confidence.backgroundColor }}
              className="px-2.5 py-1 rounded-md mb-3"
            >
              <Text style={{ color: confidence.textColor }} className="text-xs font-bold">
                {confidence.label}
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-center gap-3">
            <ActionButton
              label={editing ? "Save" : "Edit"}
              onPress={() => (editing ? applyEdit() : setEditing(true))}
              compact
              variant={editing ? "primary" : "soft"}
              icon={
                editing ? (
                  <Feather name="check" size={12} color="#FFFFFF" />
                ) : (
                  <Feather name="edit-2" size={12} color={COLORS.onSurface} />
                )
              }
            />

            {isDraft && onRemove ? (
              <ActionButton
                label="Remove"
                onPress={() => onRemove(index)}
                compact
                variant="danger"
                icon={<Feather name="trash-2" size={12} color={COLORS.error} />}
              />
            ) : null}
          </View>
        </View>
      </View>

      {editing ? (
        <View className="gap-3">
          <View>
            <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurfaceMuted }}>
              First Half Start (HH:mm)
            </Text>
            <TextInput
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ borderWidth: 1, borderColor: COLORS.outline, color: COLORS.onSurface }}
              value={first}
              onChangeText={setFirst}
              placeholder="HH:mm"
            />
          </View>

          <View>
            <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurfaceMuted }}>
              Second Half Start (HH:mm)
            </Text>
            <TextInput
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ borderWidth: 1, borderColor: COLORS.outline, color: COLORS.onSurface }}
              value={second}
              onChangeText={setSecond}
              placeholder="HH:mm"
            />
          </View>

          <View>
            <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurfaceMuted }}>
              Note
            </Text>
            <TextInput
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ borderWidth: 1, borderColor: COLORS.outline, color: COLORS.onSurface }}
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
            />
          </View>
        </View>
      ) : (
        <View className="gap-5">
          <TimeBlock label="First Half" value={slot.firstHalfStart} accent={dayMeta.accent} />
          <TimeBlock label="Second Half" value={slot.secondHalfStart} accent={dayMeta.accent} />

          {slot.note ? (
            <View className="flex-row items-start gap-2">
              <View className="mt-0.5">
                <Feather name="file-text" size={13} color={COLORS.onSurfaceMuted} />
              </View>
              <Text className="text-sm flex-1 leading-5" style={{ color: COLORS.onSurfaceMuted }}>
                {slot.note}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function WeeklyRoutineScreen() {
  const insets = useSafeAreaInsets();
  const {
    draft,
    routine,
    isAnalyzing,
    isLoading,
    error,
    analyzeImage,
    updateDraftSlot,
    removeDraftSlot,
    confirmDraft,
    fetchRoutine,
    updateSavedSlot,
    deleteRoutine,
    clearDraft,
    clearError,
  } = useRoutineStore();

  const [refreshing, setRefreshing] = useState(false);
  const [schedulingReminders, setSchedulingReminders] = useState(false);
  const [syncDaysModalVisible, setSyncDaysModalVisible] = useState(false);
  const [syncDaysConfig, setSyncDaysConfig] = useState('30');
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    fetchRoutine();
  }, [fetchRoutine]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoutine();
    setRefreshing(false);
  }, [fetchRoutine]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Needed",
        "Please allow access to your photos to upload a routine image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      clearError();
      await analyzeImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Needed",
        "Please allow camera access to take a photo of your routine.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      clearError();
      await analyzeImage(result.assets[0].uri);
    }
  };

  const handleConfirm = async () => {
    await confirmDraft();

    const currentRoutine = useRoutineStore.getState().routine;
    if (currentRoutine.length > 0) {
      setSyncDaysModalVisible(true);
      setPendingConfirm(true);
    }
  };

  const rescheduleReminders = () => {
    setSyncDaysModalVisible(true);
    setPendingConfirm(false);
  };

  const executeSync = async () => {
    setSyncDaysModalVisible(false);
    const parsedDays = parseInt(syncDaysConfig, 10);
    const daysToSync = isNaN(parsedDays) || parsedDays <= 0 ? 30 : parsedDays;

    setSchedulingReminders(true);
    try {
      const currentRoutine = useRoutineStore.getState().routine;
      // Also schedule standard app notifications
      await scheduleWeeklyReminders(currentRoutine);

      // Now add to native calendar
      await syncRoutineToCalendar(currentRoutine, daysToSync);

      Alert.alert(
        "Done",
        `Reminders saved. Successfully synced classes for the next ${daysToSync} days to your calendar.`,
      );
    } catch {
      Alert.alert("Error", "Could not fully update your reminders.");
    } finally {
      setSchedulingReminders(false);
      setPendingConfirm(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Routine",
      "This will remove all routine entries and cancel all reminders.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await cancelAllReminders();
            // Remove native synced events too
            await clearSyncedRoutinesFromCalendar();
            await deleteRoutine();
          },
        },
      ],
    );
  };

  const sortedDraft = [...draft]
    .map((slot, idx) => ({ slot, idx }))
    .sort((a, b) => dayIndex(a.slot.day) - dayIndex(b.slot.day));

  const sortedRoutine = [...routine].sort(
    (a, b) => dayIndex(a.day) - dayIndex(b.day),
  );

  const hasDraft = draft.length > 0;
  const hasRoutine = routine.length > 0;

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: COLORS.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 124 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="mb-6">
          <View className="mb-1">
            <Text className="text-4xl font-extrabold tracking-tight" style={{ color: COLORS.onSurface }}>
              Weekly Routine
            </Text>
            <Text className="text-base mt-1" style={{ color: COLORS.secondary }}>
              Curated schedule for your semester workflow
            </Text>
          </View>
        </View>

        {error && (
          <View className="rounded-xl p-4 mb-5" style={{ backgroundColor: "#FDECEC", borderWidth: 1, borderColor: "#F6CACA" }}>
            <Text className="text-base" style={{ color: "#962D2A" }}>{error}</Text>
            <View className="mt-3 self-start">
              <ActionButton
                label="Dismiss"
                onPress={clearError}
                compact
                variant="danger"
                icon={<Feather name="x" size={14} color={COLORS.error} />}
              />
            </View>
          </View>
        )}

        {!hasDraft && (
          <View className="mb-7">
            <View
              className="rounded-xl p-5"
              style={{ backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.outline }}
            >
              <View
                className="items-center rounded-xl py-10 px-6"
                style={{ backgroundColor: COLORS.surface, borderWidth: 2, borderStyle: "dashed", borderColor: "#D1D5DB" }}
              >
                <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: COLORS.primarySoft }}>
                  <Ionicons name="cloud-upload-outline" size={32} color={COLORS.primary} />
                </View>

                <Text className="text-xl font-extrabold" style={{ color: COLORS.onSurface }}>
                  Upload Routine Image
                </Text>

                <Text className="text-sm text-center mt-2 mb-6 leading-5" style={{ color: COLORS.onSurfaceMuted }}>
                  Scan or upload your class routine and let AI organize your weekly schedule.
                </Text>

                {isAnalyzing ? (
                  <View className="items-center py-3">
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text className="text-sm font-bold mt-2" style={{ color: COLORS.primary }}>
                      Analyzing image...
                    </Text>
                  </View>
                ) : (
                  <View className="w-full gap-3">
                    <ActionButton
                      label="Take Photo"
                      onPress={takePhoto}
                      variant="primary"
                      icon={<Ionicons name="camera-outline" size={18} color="#FFFFFF" />}
                    />

                    <ActionButton
                      label="Browse Gallery"
                      onPress={pickImage}
                      variant="soft"
                      icon={<Ionicons name="image-outline" size={18} color={COLORS.onSurface} />}
                    />
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {hasDraft && (
          <View className="mb-7">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 pr-3">
                <Text className="text-2xl font-extrabold" style={{ color: COLORS.onSurface }}>
                  Review Extracted Routine
                </Text>
                <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                  Check each day before confirming reminders.
                </Text>
              </View>

              <ActionButton
                label="Discard"
                onPress={clearDraft}
                compact
                variant="soft"
                icon={<Feather name="trash-2" size={14} color={COLORS.onSurface} />}
              />
            </View>

            {sortedDraft.map(({ slot, idx }) => (
              <SlotCard
                key={`${slot.day}-${idx}`}
                slot={slot}
                index={idx}
                isDraft={true}
                onUpdate={(i, patch) => updateDraftSlot(i, patch)}
                onRemove={(i) => removeDraftSlot(i)}
              />
            ))}

            {isLoading || schedulingReminders ? (
              <View
                style={{
                  backgroundColor: "#89AEF6",
                  borderRadius: 10,
                  minHeight: 46,
                  borderWidth: 1,
                  borderColor: "#89AEF6",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>Saving...</Text>
              </View>
            ) : (
              <ActionButton
                label="Confirm and Set Reminders"
                onPress={handleConfirm}
                variant="primary"
                icon={<Feather name="check-circle" size={18} color="#FFFFFF" />}
              />
            )}
          </View>
        )}

        {hasRoutine && !hasDraft && (
          <View className="mb-7">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-2xl font-extrabold" style={{ color: COLORS.onSurface }}>
                  Saved Routine
                </Text>
                <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                  Semester plan synced to reminders and calendar.
                </Text>
              </View>

              <ActionButton
                label={schedulingReminders ? "Syncing" : "Sync"}
                onPress={rescheduleReminders}
                disabled={schedulingReminders}
                compact
                variant="soft"
                icon={<Feather name="refresh-cw" size={14} color={COLORS.onSurface} />}
              />
            </View>

            {sortedRoutine.map((slot, idx) => (
              <SlotCard
                key={`saved-${slot.day}-${idx}`}
                slot={slot}
                index={idx}
                isDraft={false}
                onUpdate={(_idx, patch) => {
                  if (slot.id) updateSavedSlot(slot.id, patch);
                }}
              />
            ))}

            <View className="flex-row gap-3 mt-1">
              <ActionButton
                label="Re-upload"
                onPress={takePhoto}
                variant="soft"
                icon={<Feather name="upload" size={16} color={COLORS.onSurface} />}
                containerStyle={{ flex: 1 }}
              />

              <ActionButton
                label="Delete"
                onPress={handleDelete}
                variant="danger"
                icon={<Feather name="trash-2" size={16} color={COLORS.error} />}
                containerStyle={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {!hasDraft && !hasRoutine && !isLoading && (
          <View className="rounded-xl p-5 mb-7" style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}>
            <Text className="text-base font-bold" style={{ color: COLORS.onSurface }}>
              No routine saved yet
            </Text>
            <Text className="text-base mt-1" style={{ color: COLORS.onSurfaceMuted }}>
              Upload your routine image above to start weekly reminders.
            </Text>
          </View>
        )}

        {isLoading && !hasDraft ? (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : null}

        <View className="h-2" />
      </ScrollView>

      <Modal
        visible={syncDaysModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSyncDaysModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center p-5" style={{ backgroundColor: "rgba(12,15,25,0.45)" }}>
          <View className="w-full max-w-sm rounded-xl p-5" style={{ backgroundColor: COLORS.surface }}>
            <Text className="text-xl font-extrabold mb-1" style={{ color: COLORS.onSurface }}>
              Sync to Calendar
            </Text>
            <Text className="text-base mb-4" style={{ color: COLORS.onSurfaceMuted }}>
              Enter how many days ahead the routine should be created in your native calendar.
            </Text>

            <TextInput
              className="rounded-lg px-4 py-3 mb-5 text-base"
              style={{ borderWidth: 1, borderColor: COLORS.outline, color: COLORS.onSurface }}
              keyboardType="numeric"
              value={syncDaysConfig}
              onChangeText={setSyncDaysConfig}
              placeholder="e.g. 30"
              maxLength={3}
            />

            <View className="flex-row gap-3">
              <ActionButton
                label="Cancel"
                onPress={() => setSyncDaysModalVisible(false)}
                variant="soft"
                icon={<Feather name="x" size={16} color={COLORS.onSurface} />}
                containerStyle={{ flex: 1 }}
              />

              <ActionButton
                label={pendingConfirm ? "Confirm and Sync" : "Sync"}
                onPress={executeSync}
                variant="primary"
                icon={<Feather name="check" size={16} color="#FFFFFF" />}
                containerStyle={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
