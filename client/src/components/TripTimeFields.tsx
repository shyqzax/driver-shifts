import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { dayOffsetOf, formatClockTime, LAST_END_MINUTE } from "../domain/freeTime";
import { useTripTimeOptions } from "../hooks/useTripTimeOptions";
import { useAppStore } from "../store/useAppStore";
import { spacing } from "../theme";
import { TimePicker } from "./TimePicker";

type OpenPicker = "start" | "end" | null;

function describeEndLimit(latestEnd: number | null): string | undefined {
  if (latestEnd === null || latestEnd >= LAST_END_MINUTE) return undefined;
  const day = dayOffsetOf(latestEnd) > 0 ? " следующего дня" : "";
  return `Свободно до ${formatClockTime(latestEnd)}${day} — дальше следующая поездка`;
}

export function TripTimeFields() {
  const { startOptions, endOptions, latestEnd, suggestedStartHour } = useTripTimeOptions();
  const { startMinute, endMinute, startError, endError } = useAppStore(
    useShallow((state) => ({
      startMinute: state.draft?.startMinute ?? null,
      endMinute: state.draft?.endMinute ?? null,
      startError: state.draftErrors.start,
      endError: state.draftErrors.end,
    }))
  );
  const updateDraft = useAppStore((state) => state.updateDraft);
  // Какой выбор раскрыт — забота экрана, а не данных поездки
  const [openPicker, setOpenPicker] = useState<OpenPicker>("start");

  const toggleStart = useCallback(() => setOpenPicker((current) => (current === "start" ? null : "start")), []);
  const toggleEnd = useCallback(() => setOpenPicker((current) => (current === "end" ? null : "end")), []);
  const chooseStart = useCallback(
    (minuteValue: number) => {
      updateDraft({ startMinute: minuteValue });
      setOpenPicker("end");
    },
    [updateDraft]
  );
  const chooseEnd = useCallback(
    (minuteValue: number) => {
      updateDraft({ endMinute: minuteValue });
      setOpenPicker(null);
    },
    [updateDraft]
  );

  const hasStart = startMinute !== null;

  return (
    <View style={styles.container}>
      <TimePicker
        label="Начало"
        value={startMinute}
        options={startOptions}
        isOpen={openPicker === "start"}
        placeholder="Выбрать время"
        error={startError}
        suggestedHour={suggestedStartHour}
        onToggle={toggleStart}
        onChange={chooseStart}
      />
      <TimePicker
        label="Окончание"
        value={endMinute}
        options={endOptions}
        isOpen={openPicker === "end" && hasStart}
        disabled={!hasStart}
        placeholder={hasStart ? "Выбрать время" : "Сначала выберите начало"}
        hint={describeEndLimit(latestEnd)}
        error={endError}
        suggestedHour={startMinute !== null ? Math.floor((startMinute + 1) / 60) : undefined}
        onToggle={toggleEnd}
        onChange={chooseEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
});
