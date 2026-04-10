import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabIcon = ({
  name,
  focused,
  iconChar,
}: {
  name: string;
  focused: boolean;
  iconChar: string;
}) => (
  <View className="items-center justify-center gap-1">
    <Text className={`text-2xl ${focused ? "text-blue-600" : "text-gray-500"}`}>
      {iconChar}
    </Text>
    <Text
      className={`text-xs font-semibold ${
        focused ? "text-blue-600" : "text-gray-500"
      }`}
      numberOfLines={1}
    >
      {name}
    </Text>
  </View>
);

export default function TabsLayout() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 10,
          height: 70 + Math.max(insets.bottom, 0),
          paddingHorizontal: 4,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
          gap: 2,
          flex: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2,
        },
        sceneStyle: {
          backgroundColor: "#f9fafb",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Notices",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Notices" focused={focused} iconChar="📢" />
          ),
        }}
      />
      <Tabs.Screen
        name="bus-tracking"
        options={{
          title: "Bus Track",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Track" focused={focused} iconChar="🚌" />
          ),
        }}
      />
      <Tabs.Screen
        name="weekly-routine"
        options={{
          title: "Routine",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Routine" focused={focused} iconChar="📋" />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Calendar" focused={focused} iconChar="📅" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Profile" focused={focused} iconChar="👤" />
          ),
        }}
      />
    </Tabs>
  );
}
