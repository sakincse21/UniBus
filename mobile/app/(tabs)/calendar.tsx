import React from "react";
import { View } from "react-native";
import CalendarView from "@/components/CalendarView";

export default function CalendarScreen() {
  return (
    <View className="flex-1 bg-white">
      <CalendarView daysToShow={30} />
    </View>
  );
}
