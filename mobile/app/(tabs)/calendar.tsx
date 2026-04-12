import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CalendarView from "@/components/CalendarView";

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <CalendarView daysToShow={30} />
    </View>
  );
}
