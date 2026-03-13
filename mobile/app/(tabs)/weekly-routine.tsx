import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRoutineStore } from "@/store/routineStore";
import { IRoutineSlot } from "@/interfaces";
import {
  scheduleWeeklyReminders,
  cancelAllReminders,
  addRoutineToCalendar,
} from "@/lib/reminders";

const DAY_ORDER = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

const DAY_LABELS: Record<string, string> = {
  saturday: "Sat",
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
};

/** Color indicator for confidence level */
function confidenceBadge(c: number) {
  if (c >= 0.8) return "bg-green-100 text-green-700";
  if (c >= 0.5) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

// ── Slot Card (shared between draft and saved views) ──────────────────────────

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

  const applyEdit = () => {
    onUpdate(index, {
      firstHalfStart: first,
      secondHalfStart: second,
      note,
    });
    setEditing(false);
  };

  return (
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className="bg-blue-600 rounded-lg px-3 py-1 mr-2">
            <Text className="text-white font-bold text-sm">
              {DAY_LABELS[slot.day] || slot.day}
            </Text>
          </View>
          {isDraft && (
            <View className={`rounded-full px-2 py-0.5 ${confidenceBadge(slot.confidence)}`}>
              <Text className="text-xs font-medium">
                {Math.round(slot.confidence * 100)}%
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row">
          <TouchableOpacity
            onPress={() => (editing ? applyEdit() : setEditing(true))}
            className="mr-2"
          >
            <Text className="text-blue-600 font-medium text-sm">
              {editing ? "Save" : "Edit"}
            </Text>
          </TouchableOpacity>
          {isDraft && onRemove && (
            <TouchableOpacity onPress={() => onRemove(index)}>
              <Text className="text-red-500 font-medium text-sm">Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Times */}
      {editing ? (
        <View>
          <View className="flex-row items-center mb-2">
            <Text className="text-gray-500 w-28 text-sm">1st Half:</Text>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-1.5 flex-1 text-sm"
              value={first}
              onChangeText={setFirst}
              placeholder="HH:mm"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View className="flex-row items-center mb-2">
            <Text className="text-gray-500 w-28 text-sm">2nd Half:</Text>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-1.5 flex-1 text-sm"
              value={second}
              onChangeText={setSecond}
              placeholder="HH:mm"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View className="flex-row items-center">
            <Text className="text-gray-500 w-28 text-sm">Note:</Text>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-1.5 flex-1 text-sm"
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
            />
          </View>
        </View>
      ) : (
        <View>
          <View className="flex-row mb-1">
            <Text className="text-gray-500 text-sm w-28">1st Half:</Text>
            <Text className="text-gray-900 font-semibold text-sm">
              {slot.firstHalfStart || "—"}
            </Text>
          </View>
          <View className="flex-row mb-1">
            <Text className="text-gray-500 text-sm w-28">2nd Half:</Text>
            <Text className="text-gray-900 font-semibold text-sm">
              {slot.secondHalfStart || "—"}
            </Text>
          </View>
          {slot.note ? (
            <Text className="text-gray-400 text-xs mt-1">{slot.note}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function WeeklyRoutineScreen() {
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
    clearError,
  } = useRoutineStore();

  const [refreshing, setRefreshing] = useState(false);
  const [schedulingReminders, setSchedulingReminders] = useState(false);

  useEffect(() => {
    fetchRoutine();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoutine();
    setRefreshing(false);
  }, [fetchRoutine]);

  // ── Pick image ──────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
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
        "Permission needed",
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

  // ── Confirm & schedule ──────────────────────────────────────────────────────

  const handleConfirm = async () => {
    await confirmDraft();

    // Schedule notifications after saving
    const currentRoutine = useRoutineStore.getState().routine;
    if (currentRoutine.length > 0) {
      setSchedulingReminders(true);
      try {
        await scheduleWeeklyReminders(currentRoutine);
        Alert.alert(
          "Routine Saved!",
          "Weekly reminders have been set 10 minutes before each session.",
          [
            {
              text: "Also Add to Calendar",
              onPress: async () => {
                try {
                  const count = await addRoutineToCalendar(currentRoutine);
                  Alert.alert(
                    "Done",
                    `${count} calendar events created with reminders.`,
                  );
                } catch {
                  Alert.alert(
                    "Info",
                    "Calendar events could not be created. Local notifications are still active.",
                  );
                }
              },
            },
            { text: "Skip", style: "cancel" },
          ],
        );
      } catch {
        Alert.alert(
          "Saved",
          "Routine saved, but notification permission was not granted. Please enable notifications in settings.",
        );
      } finally {
        setSchedulingReminders(false);
      }
    }
  };

  // ── Reschedule after editing saved slots ────────────────────────────────────

  const rescheduleReminders = async () => {
    setSchedulingReminders(true);
    try {
      await scheduleWeeklyReminders(routine);
      Alert.alert("Done", "Reminders updated successfully.");
    } catch {
      Alert.alert("Error", "Could not update reminders.");
    } finally {
      setSchedulingReminders(false);
    }
  };

  // ── Delete routine ──────────────────────────────────────────────────────────

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
            await deleteRoutine();
          },
        },
      ],
    );
  };

  // ── Sort slots by day order ─────────────────────────────────────────────────

  const sortedDraft = [...draft].sort(
    (a, b) => DAY_ORDER.indexOf(a.day as any) - DAY_ORDER.indexOf(b.day as any),
  );
  const sortedRoutine = [...routine].sort(
    (a, b) => DAY_ORDER.indexOf(a.day as any) - DAY_ORDER.indexOf(b.day as any),
  );

  const hasDraft = draft.length > 0;
  const hasRoutine = routine.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">
          Weekly Routine
        </Text>
        <Text className="text-gray-500 text-sm mt-1">
          Upload your routine image and set class reminders
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Error banner */}
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
            <TouchableOpacity onPress={clearError} className="mt-1">
              <Text className="text-red-500 text-xs font-medium">Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upload section */}
        {!hasDraft && (
          <View className="mb-6">
            <View className="bg-white rounded-xl p-6 border border-dashed border-blue-300 items-center">
              <Text className="text-4xl mb-3">📸</Text>
              <Text className="text-gray-700 font-semibold text-base mb-1">
                Upload Routine Image
              </Text>
              <Text className="text-gray-400 text-xs text-center mb-4">
                Take a photo or pick from gallery. AI will extract your class
                times.
              </Text>

              {isAnalyzing ? (
                <View className="items-center py-4">
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text className="text-blue-600 text-sm mt-2">
                    Analyzing with AI...
                  </Text>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={takePhoto}
                    className="bg-blue-600 rounded-lg px-5 py-2.5"
                  >
                    <Text className="text-white font-semibold text-sm">
                      Camera
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickImage}
                    className="bg-gray-100 rounded-lg px-5 py-2.5 border border-gray-200"
                  >
                    <Text className="text-gray-700 font-semibold text-sm">
                      Gallery
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Draft Review Section ─────────────────────────────────────────── */}
        {hasDraft && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-lg font-bold text-gray-900">
                  Review & Edit
                </Text>
                <Text className="text-gray-400 text-xs">
                  AI-extracted schedule. Tap Edit to fix any times.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => useRoutineStore.getState().clearDraft()}
                className="bg-gray-100 rounded-lg px-3 py-1.5"
              >
                <Text className="text-gray-600 text-xs font-medium">
                  Discard
                </Text>
              </TouchableOpacity>
            </View>

            {sortedDraft.map((slot, idx) => (
              <SlotCard
                key={`${slot.day}-${idx}`}
                slot={slot}
                index={draft.indexOf(slot)}
                isDraft={true}
                onUpdate={(i, patch) => updateDraftSlot(i, patch)}
                onRemove={(i) => removeDraftSlot(i)}
              />
            ))}

            {/* Confirm button */}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isLoading || schedulingReminders}
              className={`rounded-xl py-3.5 mt-2 ${
                isLoading || schedulingReminders
                  ? "bg-blue-300"
                  : "bg-blue-600"
              }`}
            >
              {isLoading || schedulingReminders ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center font-bold text-base">
                  Confirm & Set Reminders
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Saved Routine Section ────────────────────────────────────────── */}
        {hasRoutine && !hasDraft && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900">
                Your Routine
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={rescheduleReminders}
                  disabled={schedulingReminders}
                  className="bg-blue-50 rounded-lg px-3 py-1.5"
                >
                  <Text className="text-blue-600 text-xs font-medium">
                    {schedulingReminders ? "..." : "Sync Reminders"}
                  </Text>
                </TouchableOpacity>
              </View>
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

            {/* Action buttons */}
            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity
                onPress={pickImage}
                className="flex-1 bg-gray-100 rounded-xl py-3 border border-gray-200"
              >
                <Text className="text-gray-700 text-center font-semibold text-sm">
                  Re-upload Routine
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                className="bg-red-50 rounded-xl px-4 py-3 border border-red-200"
              >
                <Text className="text-red-600 font-semibold text-sm">
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Empty state */}
        {!hasDraft && !hasRoutine && !isLoading && (
          <View className="items-center py-10">
            <Text className="text-gray-400 text-sm">
              No routine set yet. Upload your weekly schedule above.
            </Text>
          </View>
        )}

        {isLoading && !hasDraft && (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        )}

        {/* Bottom spacer */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
