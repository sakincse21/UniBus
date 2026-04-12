import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 justify-center items-center bg-white p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">
          404 - Not Found
        </Text>
        <Text className="text-gray-500 text-center mb-6">
          The page you're looking for doesn't exist.
        </Text>
        <Link href="/(tabs)" className="bg-blue-600 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Go Home</Text>
        </Link>
      </View>
    </>
  );
}
