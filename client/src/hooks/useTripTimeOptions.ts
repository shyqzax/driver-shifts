import { useMemo } from "react";
import {
  busyRangesOfDay,
  freeEndMinutes,
  freeStartMinutes,
  latestEndMinute,
  MINUTES_PER_DAY,
  type MinuteRange,
} from "../domain/freeTime";
import { useAppStore } from "../store/useAppStore";

export interface TripTimeOptions {
  startOptions: number[];
  endOptions: number[];
  /** Окончание не позже этой минуты; `null` — начало ещё не выбрано */
  latestEnd: number | null;
  /** Час, где обычно продолжается смена: сразу после последней поездки дня */
  suggestedStartHour: number | undefined;
}

function suggestStartHour(ranges: readonly MinuteRange[]): number | undefined {
  const tripsOfDay = ranges.filter((range) => range.from < MINUTES_PER_DAY);
  const lastTrip = tripsOfDay[tripsOfDay.length - 1];
  if (!lastTrip) return undefined;
  return Math.min(Math.floor(lastTrip.to / 60), 23);
}

/** Свободные варианты времени для формы — из занятого времени, которое прислал сервер. */
export function useTripTimeOptions(): TripTimeOptions {
  const report = useAppStore((state) => state.dayReport);
  const startMinute = useAppStore((state) => state.draft?.startMinute ?? null);

  const ranges = useMemo(
    () => (report ? busyRangesOfDay(report.date, report.tzOffset, report.busy) : []),
    [report]
  );
  const startOptions = useMemo(() => freeStartMinutes(ranges), [ranges]);
  const endOptions = useMemo(
    () => (startMinute === null ? [] : freeEndMinutes(startMinute, ranges)),
    [ranges, startMinute]
  );

  return {
    startOptions,
    endOptions,
    latestEnd: startMinute === null ? null : latestEndMinute(startMinute, ranges),
    suggestedStartHour: suggestStartHour(ranges),
  };
}
