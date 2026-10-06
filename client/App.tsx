import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DayScreen } from "./src/screens/DayScreen";
import { TripDetailsSheet } from "./src/screens/TripDetailsSheet";
import { TripFormScreen } from "./src/screens/TripFormScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <DayScreen />
      <TripDetailsSheet />
      <TripFormScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
