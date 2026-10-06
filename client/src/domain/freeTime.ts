/**
 * Время в форме считается в минутах от полуночи выбранного дня по часам
 * бизнеса: 0 — 00:00, 1439 — 23:59, 1440 и дальше — уже следующий день.
 * Так поездка через полночь — просто окончание больше 1440, без галочек.
 */
export const MINUTES_PER_DAY = 24 * 60;

/** Сервер присылает занятое время на два дня — позже окончание не выбрать. */
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

export interface HourGroup {
  /** 0–23 — выбранный день, 24–47 — следующий */
  hour: number;
  minutes: number[];
}

/**
 * Начало округляется вниз, конец — вверх: если поездка записана с секундами,
 * лучше спрятать лишнюю минуту, чем предложить время, которое сервер отклонит.
 */
export function toMinuteRanges(busy: readonly BusyTime[], dayStartMs: number): MinuteRange[] {
  return busy
    .map(({ start, end }) => ({
      from: Math.floor((Date.parse(start) - dayStartMs) / MS_PER_MINUTE),
      to: Math.ceil((Date.parse(end) - dayStartMs) / MS_PER_MINUTE),
    }))
    .sort((left, right) => left.from - right.from);
}

/** Занятое время дня `date` в минутах от его полуночи по часам бизнеса. */
export function busyRangesOfDay(date: string, tzOffset: string, busy: readonly BusyTime[]): MinuteRange[] {
  return toMinuteRanges(busy, Date.parse(`${date}T00:00:00${tzOffset}`));
}

function isMinuteBusy(minute: number, ranges: readonly MinuteRange[]): boolean {
  return ranges.some((range) => range.from <= minute && minute < range.to);
}

/** Поездка дня начинается в этот же день: варианты начала — только 00:00…23:59. */
export function freeStartMinutes(ranges: readonly MinuteRange[]): number[] {
  const free: number[] = [];
  for (let minute = 0; minute < MINUTES_PER_DAY; minute += 1) {
    if (!isMinuteBusy(minute, ranges)) free.push(minute);
  }
  return free;
}

/** Самое позднее окончание — начало следующей поездки: встык можно, внахлёст нельзя. */
export function latestEndMinute(start: number, ranges: readonly MinuteRange[]): number {
  const nextTrip = ranges.find((range) => range.from > start);
  return Math.min(nextTrip?.from ?? LAST_END_MINUTE, LAST_END_MINUTE);
}

export function freeEndMinutes(start: number, ranges: readonly MinuteRange[]): number[] {
  if (isMinuteBusy(start, ranges)) return [];
  const latest = latestEndMinute(start, ranges);
  const free: number[] = [];
  for (let minute = start + 1; minute <= latest; minute += 1) {
    free.push(minute);
  }
  return free;
}

export function isEndStillAllowed(start: number, end: number, ranges: readonly MinuteRange[]): boolean {
  return !isMinuteBusy(start, ranges) && end > start && end <= latestEndMinute(start, ranges);
}

export function groupByHour(minuteValues: readonly number[]): HourGroup[] {
  const groups: HourGroup[] = [];
  for (const value of minuteValues) {
    const hour = Math.floor(value / 60);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.hour === hour) {
      lastGroup.minutes.push(value);
    } else {
      groups.push({ hour, minutes: [value] });
    }
  }
  return groups;
}

/** На сколько дней после выбранного приходится минута: 0 — тот же день, 1 — следующий. */
export function dayOffsetOf(minuteValue: number): number {
  return Math.floor(minuteValue / MINUTES_PER_DAY);
}

/** 750 → `12:30`, 1455 → `00:15` (день показывается отдельно, см. dayOffsetOf). */
export function formatClockTime(minuteValue: number): string {
  const minuteOfDay = minuteValue % MINUTES_PER_DAY;
  const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const minutes = String(minuteOfDay % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}
