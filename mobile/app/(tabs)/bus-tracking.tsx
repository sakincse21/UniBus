import React from "react";
import { View, Text } from "react-native";

export default function BusTrackingTab() {
  return (
    <View className="flex-1 bg-white justify-center items-center">
      <View className="items-center px-8">
        <Text className="text-4xl mb-4">🚌</Text>
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Bus Tracking
        </Text>
        <Text className="text-gray-500 text-center">
          This feature is coming soon!
        </Text>
        <Text className="text-gray-400 text-center mt-2">
          Real-time bus location tracking will be available here.
        </Text>
      </View>
    </View>
  );
}
