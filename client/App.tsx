import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DayScreen } from "./src/screens/DayScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <DayScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
