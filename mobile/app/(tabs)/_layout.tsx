import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useAuthStore } from "@/store/authStore";

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <View className="items-center">
    <Text
      className={`text-xs ${
        focused ? "text-blue-600 font-bold" : "text-gray-500"
      }`}
    >
      {name}
    </Text>
  </View>
);

export default function TabsLayout() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Notices",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Notices" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bus-tracking"
        options={{
          title: "Bus",
          tabBarIcon: ({ focused }) => <TabIcon name="Bus" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="weekly-routine"
        options={{
          title: "Routine",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Routine" focused={focused} />
          ),
        }}
      />
      {isAdmin && (
        <Tabs.Screen
          name="pending-notice"
          options={{
            title: "Pending",
            tabBarIcon: ({ focused }) => (
              <TabIcon name="Pending" focused={focused} />
            ),
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
