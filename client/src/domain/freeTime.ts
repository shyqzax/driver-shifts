/**
 * Время в форме считается в минутах от полуночи выбранного дня по часам
 * бизнеса: 0 — 00:00, 1439 — 23:59, 1440 и дальше — уже следующий день.
 * Поездка через полночь — просто окончание больше 1440.
 */
export const MINUTES_PER_DAY = 24 * 60;

/** Сервер присылает занятое время на два дня — дальше окончание не проверить. */
export const LAST_END_MINUTE = 2 * MINUTES_PER_DAY - 1;

const MS_PER_MINUTE = 60_000;

/** Занятые минуты `[from, to)`: поездка 12:00–12:25 занимает 720…744, а 745 уже свободна. */
export interface MinuteRange {
  from: number;
  to: number;
}

export interface BusyTime {
  start: string;
  end: string;
}

/**
 * Начало округляется вниз, конец — вверх: если поездка записана с секундами,
 * лучше считать занятой лишнюю минуту, чем пропустить время, которое сервер отклонит.
 */
export function toMinuteRanges(busy: readonly BusyTime[], dayStartMs: number): MinuteRange[] {
  return busy
    .map(({ start, end }) => ({
      from: Math.floor((Date.parse(start) - dayStartMs) / MS_PER_MINUTE),
      to: Math.ceil((Date.parse(end) - dayStartMs) / MS_PER_MINUTE),
    }))
    .sort((left, right) => left.from - right.from);
}

export function dayStartMsOf(date: string, tzOffset: string): number {
  return Date.parse(`${date}T00:00:00${tzOffset}`);
}

/**
 * Занятое время дня `date` в минутах от его полуночи по часам бизнеса.
 * При редактировании своё же время поездке не мешает — его исключаем.
 */
export function busyRangesOfDay(
  date: string,
  tzOffset: string,
  busy: readonly (BusyTime & { tripId: string })[],
  excludeTripId?: string
): MinuteRange[] {
  const others = excludeTripId ? busy.filter((interval) => interval.tripId !== excludeTripId) : busy;
  return toMinuteRanges(others, dayStartMsOf(date, tzOffset));
}

/** Поездка, внутри которой лежит эта минута. */
export function rangeContaining(minute: number, ranges: readonly MinuteRange[]): MinuteRange | undefined {
  return ranges.find((range) => range.from <= minute && minute < range.to);
}

/** Поездка, с которой пересекается промежуток `[start, end)`. Встык — не пересечение. */
export function overlappingRange(start: number, end: number, ranges: readonly MinuteRange[]): MinuteRange | undefined {
  return ranges.find((range) => range.from < end && start < range.to);
}

/** Самое позднее окончание — начало следующей поездки: встык можно, внахлёст нельзя. */
export function latestEndMinute(start: number, ranges: readonly MinuteRange[]): number {
  const nextTrip = ranges.find((range) => range.from > start);
  return Math.min(nextTrip?.from ?? LAST_END_MINUTE, LAST_END_MINUTE);
}

/** На сколько дней после выбранного приходится минута: 0 — тот же день, 1 — следующий. */
export function dayOffsetOf(minuteValue: number): number {
  return Math.floor(minuteValue / MINUTES_PER_DAY);
}

/**
 * 750 → `12:30`, 1455 → `00:15`, −20 → `23:40` (ночная поездка вчерашнего дня).
 * День показывается отдельно, см. dayOffsetOf.
 */
export function formatClockTime(minuteValue: number): string {
  const minuteOfDay = ((minuteValue % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const minutes = String(minuteOfDay % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function describeRange(range: MinuteRange): string {
  return `${formatClockTime(range.from)}–${formatClockTime(range.to)}`;
}
