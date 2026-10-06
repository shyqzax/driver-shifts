import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AddTripScreen } from "./src/screens/AddTripScreen";
import { DayScreen } from "./src/screens/DayScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <DayScreen />
      <AddTripScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
