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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRoutineStore } from "@/store/routineStore";
import { IRoutineSlot } from "@/interfaces";
import { scheduleWeeklyReminders, cancelAllReminders } from "@/lib/reminders";
import { addRoutineToCalendar } from "@/lib/calendar";

// Correct day order - Sunday is first (0) in JavaScript Date
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

function confidenceBadge(c: number): string {
  if (c >= 0.8) return "bg-green-100 text-green-700";
  if (c >= 0.5) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
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

  const applyEdit = () => {
    onUpdate(index, {
      firstHalfStart: first,
      secondHalfStart: second,
      note,
    });
    setEditing(false);
  };

  return (
    <View className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="bg-blue-600 rounded px-3 py-1 mr-2">
            <Text className="text-white font-medium text-sm">
              {DAY_LABELS[slot.day] || slot.day}
            </Text>
          </View>
          {isDraft && (
            <View
              className={`rounded-full px-2 py-0.5 ${confidenceBadge(slot.confidence)}`}
            >
              <Text className="text-xs font-medium">
                {Math.round(slot.confidence * 100)}%
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row">
          <TouchableOpacity
            onPress={() => (editing ? applyEdit() : setEditing(true))}
            className="mr-3"
          >
            <Text className="text-blue-600 text-sm font-medium">
              {editing ? "Save" : "Edit"}
            </Text>
          </TouchableOpacity>
          {isDraft && onRemove && (
            <TouchableOpacity onPress={() => onRemove(index)}>
              <Text className="text-red-500 text-sm font-medium">Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {editing ? (
        <View>
          <View className="flex-row items-center mb-3">
            <Text className="text-gray-500 w-24 text-sm">First Half:</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm"
              value={first}
              onChangeText={setFirst}
              placeholder="HH:mm"
            />
          </View>
          <View className="flex-row items-center mb-3">
            <Text className="text-gray-500 w-24 text-sm">Second Half:</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm"
              value={second}
              onChangeText={setSecond}
              placeholder="HH:mm"
            />
          </View>
          <View className="flex-row items-center">
            <Text className="text-gray-500 w-24 text-sm">Note:</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm"
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
            />
          </View>
        </View>
      ) : (
        <View>
          <View className="flex-row mb-2">
            <Text className="text-gray-500 text-sm w-24">First Half:</Text>
            <Text className="text-gray-900 font-medium text-sm">
              {slot.firstHalfStart || "--"}
            </Text>
          </View>
          <View className="flex-row mb-2">
            <Text className="text-gray-500 text-sm w-24">Second Half:</Text>
            <Text className="text-gray-900 font-medium text-sm">
              {slot.secondHalfStart || "--"}
            </Text>
          </View>
          {slot.note ? (
            <Text className="text-gray-500 text-xs mt-1">{slot.note}</Text>
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
      setSchedulingReminders(true);
      try {
        // Cancel any existing reminders before scheduling new ones
        await cancelAllReminders();
        await scheduleWeeklyReminders(currentRoutine);
        Alert.alert(
          "Routine Saved",
          "Weekly reminders have been set 10 minutes before each class.",
          [
            {
              text: "Add to Calendar",
              onPress: async () => {
                try {
                  const count = await addRoutineToCalendar(currentRoutine);
                  Alert.alert("Done", `${count} calendar events created.`);
                } catch {
                  Alert.alert(
                    "Info",
                    "Calendar events could not be created. Notifications are still active.",
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

  const rescheduleReminders = async () => {
    setSchedulingReminders(true);
    try {
      // Cancel existing reminders before scheduling new ones
      await cancelAllReminders();
      await scheduleWeeklyReminders(routine);
      Alert.alert("Done", "Reminders updated successfully.");
    } catch {
      Alert.alert("Error", "Could not update reminders.");
    } finally {
      setSchedulingReminders(false);
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
            await deleteRoutine();
          },
        },
      ],
    );
  };

  const sortedDraft = [...draft].sort(
    (a, b) => DAY_ORDER.indexOf(a.day as any) - DAY_ORDER.indexOf(b.day as any),
  );
  const sortedRoutine = [...routine].sort(
    (a, b) => DAY_ORDER.indexOf(a.day as any) - DAY_ORDER.indexOf(b.day as any),
  );

  const hasDraft = draft.length > 0;
  const hasRoutine = routine.length > 0;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Weekly Routine</Text>
        <Text className="text-gray-500 text-sm mt-1">
          Upload your class schedule image to set reminders
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
            <TouchableOpacity onPress={clearError} className="mt-2">
              <Text className="text-red-500 text-xs font-medium">Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {!hasDraft && (
          <View className="mb-6">
            <View className="bg-white rounded-lg p-6 border border-dashed border-blue-300 items-center">
              <Text className="text-gray-700 font-semibold text-base mb-2">
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
                    Analyzing...
                  </Text>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={takePhoto}
                    className="bg-blue-600 rounded-lg px-5 py-2"
                  >
                    <Text className="text-white font-medium text-sm">
                      Camera
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickImage}
                    className="bg-gray-100 rounded-lg px-5 py-2 border border-gray-300"
                  >
                    <Text className="text-gray-700 font-medium text-sm">
                      Gallery
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {hasDraft && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-lg font-bold text-gray-900">
                  Review Schedule
                </Text>
                <Text className="text-gray-400 text-xs">
                  AI-extracted times. Tap Edit to fix.
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

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isLoading || schedulingReminders}
              className={`rounded-lg py-3 mt-2 ${isLoading || schedulingReminders ? "bg-blue-300" : "bg-blue-600"}`}
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

        {hasRoutine && !hasDraft && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900">
                Your Routine
              </Text>
              <TouchableOpacity
                onPress={rescheduleReminders}
                disabled={schedulingReminders}
                className="bg-blue-50 rounded-lg px-3 py-1.5"
              >
                <Text className="text-blue-600 text-xs font-medium">
                  {schedulingReminders ? "Syncing..." : "Sync Reminders"}
                </Text>
              </TouchableOpacity>
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

            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity
                onPress={pickImage}
                className="flex-1 bg-gray-100 rounded-lg py-3 border border-gray-300"
              >
                <Text className="text-gray-700 text-center font-medium text-sm">
                  Re-upload Routine
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                className="bg-red-50 rounded-lg px-4 py-3 border border-red-200"
              >
                <Text className="text-red-600 font-medium text-sm">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!hasDraft && !hasRoutine && !isLoading && (
          <View className="items-center py-10">
            <Text className="text-gray-400 text-sm">No routine set yet.</Text>
            <Text className="text-gray-400 text-xs mt-1">
              Upload your schedule above.
            </Text>
          </View>
        )}

        {isLoading && !hasDraft && (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
