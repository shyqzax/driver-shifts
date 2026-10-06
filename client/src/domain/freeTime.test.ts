import { describe, expect, it } from "vitest";
import {
  busyRangesOfDay,
  dayOffsetOf,
  formatClockTime,
  freeEndMinutes,
  freeStartMinutes,
  groupByHour,
  isEndStillAllowed,
  latestEndMinute,
  toMinuteRanges,
} from "./freeTime";

const DAY_START_MS = Date.parse("2026-10-01T00:00:00+05:00");

/** 12:00 → 720 */
function at(hours: number, minutes = 0): number {
  return hours * 60 + minutes;
}

describe("занятое время в минутах дня", () => {
  it("поездка дня, ночная вчерашняя и утренняя завтрашняя", () => {
    const ranges = toMinuteRanges(
      [
        { start: "2026-10-01T12:00:00+05:00", end: "2026-10-01T12:25:00+05:00" },
        { start: "2026-09-30T23:30:00+05:00", end: "2026-10-01T00:20:00+05:00" },
        { start: "2026-10-02T07:00:00+05:00", end: "2026-10-02T07:30:00+05:00" },
      ],
      DAY_START_MS
    );
    expect(ranges).toEqual([
      { from: -30, to: 20 },
      { from: at(12), to: at(12, 25) },
      { from: 1440 + at(7), to: 1440 + at(7, 30) },
    ]);
  });

  it("время, записанное в UTC, переводится на часы бизнеса", () => {
    const ranges = toMinuteRanges([{ start: "2026-10-01T07:00:00Z", end: "2026-10-01T07:30:00Z" }], DAY_START_MS);
    expect(ranges).toEqual([{ from: at(12), to: at(12, 30) }]);
  });

  it("секунды не дают выбрать минуту, которую сервер отклонит", () => {
    const ranges = toMinuteRanges(
      [{ start: "2026-10-01T12:00:30+05:00", end: "2026-10-01T12:10:30+05:00" }],
      DAY_START_MS
    );
    expect(ranges).toEqual([{ from: at(12), to: at(12, 11) }]);
  });
});

describe("занятое время при редактировании", () => {
  const busy = [
    { tripId: "a", start: "2026-10-01T09:00:00+05:00", end: "2026-10-01T09:30:00+05:00" },
    { tripId: "b", start: "2026-10-01T12:00:00+05:00", end: "2026-10-01T12:25:00+05:00" },
  ];

  it("своё время поездке не мешает, чужое — мешает", () => {
    expect(busyRangesOfDay("2026-10-01", "+05:00", busy, "b")).toEqual([{ from: at(9), to: at(9, 30) }]);
    expect(busyRangesOfDay("2026-10-01", "+05:00", busy)).toHaveLength(2);
  });
});

describe("варианты начала", () => {
  it("пустой день — все минуты с 00:00 до 23:59", () => {
    const free = freeStartMinutes([]);
    expect(free).toHaveLength(1440);
    expect(free[0]).toBe(0);
    expect(free.at(-1)).toBe(1439);
  });

  it("минуты внутри поездки скрыты, минута её окончания свободна", () => {
    const free = freeStartMinutes([{ from: at(12), to: at(12, 25) }]);
    expect(free).not.toContain(at(12));
    expect(free).not.toContain(at(12, 24));
    expect(free).toContain(at(11, 59));
    expect(free).toContain(at(12, 25));
  });

  it("ночная поездка со вчера занимает начало дня", () => {
    const free = freeStartMinutes([{ from: -30, to: 20 }]);
    expect(free[0]).toBe(20);
  });
});

describe("варианты окончания", () => {
  const ranges = [{ from: at(12), to: at(12, 25) }];

  it("ограничены началом следующей поездки, встык можно", () => {
    expect(latestEndMinute(at(11, 30), ranges)).toBe(at(12));
    const free = freeEndMinutes(at(11, 30), ranges);
    expect(free[0]).toBe(at(11, 31));
    expect(free.at(-1)).toBe(at(12));
  });

  it("после последней поездки дня можно закончить и после полуночи", () => {
    const free = freeEndMinutes(at(23, 40), ranges);
    expect(free).toContain(1440 + 15);
    expect(free.at(-1)).toBe(2 * 1440 - 1);
  });

  it("утренняя поездка следующего дня ограничивает ночную", () => {
    const withTomorrow = [...ranges, { from: 1440 + at(7), to: 1440 + at(7, 30) }];
    expect(latestEndMinute(at(23, 40), withTomorrow)).toBe(1440 + at(7));
  });

  it("если начало занято, окончаний нет", () => {
    expect(freeEndMinutes(at(12, 10), ranges)).toEqual([]);
  });

  it("окончание сбрасывается, если после смены начала оно стало недопустимым", () => {
    expect(isEndStillAllowed(at(11), at(11, 50), ranges)).toBe(true);
    expect(isEndStillAllowed(at(11), at(12, 30), ranges)).toBe(false);
    expect(isEndStillAllowed(at(11), at(10, 50), ranges)).toBe(false);
  });
});

describe("подписи", () => {
  it("группы по часам: только часы, где есть свободные минуты", () => {
    expect(groupByHour([at(9, 58), at(9, 59), at(11, 0), 1440 + 5])).toEqual([
      { hour: 9, minutes: [at(9, 58), at(9, 59)] },
      { hour: 11, minutes: [at(11, 0)] },
      { hour: 24, minutes: [1440 + 5] },
    ]);
  });

  it("время и день для минут следующего дня", () => {
    expect(formatClockTime(at(8, 5))).toBe("08:05");
    expect(formatClockTime(1440 + 15)).toBe("00:15");
    expect(dayOffsetOf(at(23, 59))).toBe(0);
    expect(dayOffsetOf(1440 + 15)).toBe(1);
  });
});
