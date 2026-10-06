import { describe, expect, it } from "vitest";
import {
  buildTripFromDraft,
  checkDraftTimes,
  createDraft,
  draftFromTrip,
  isDraftDirty,
  mapServerFieldErrors,
  minuteToIso,
  netOfTrip,
  parseMoneyInput,
  suggestCommission,
  type DraftTimes,
} from "./tripDraft";

const TZ = "+05:00";

/** 12:00 → 720 */
function at(hours: number, minutes = 0): number {
  return hours * 60 + minutes;
}

function times(startTime: string, endTime: string, endsNextDay = false): DraftTimes {
  return { startTime, endTime, endsNextDay };
}

describe("сборка поездки из формы", () => {
  it("время дня и время после полуночи превращаются в даты с поясом", () => {
    expect(minuteToIso("2026-10-02", at(23, 40), TZ)).toBe("2026-10-02T23:40:00+05:00");
    expect(minuteToIso("2026-10-02", 1440 + 15, TZ)).toBe("2026-10-03T00:15:00+05:00");
    expect(minuteToIso("2026-10-31", 1440 + 5, TZ)).toBe("2026-11-01T00:05:00+05:00");
  });

  it("заполненная форма даёт поездку для сервера с тем же номером", () => {
    const draft = {
      ...createDraft("trip-id", "2026-10-04"),
      startTime: "12:00",
      endTime: "12:25",
      amount: "1 800",
      commission: "270",
      payment: "cash" as const,
    };
    expect(buildTripFromDraft(draft, TZ)).toEqual({
      ok: true,
      trip: {
        id: "trip-id",
        start: "2026-10-04T12:00:00+05:00",
        end: "2026-10-04T12:25:00+05:00",
        amount: 1800,
        payment: "cash",
        commission: 270,
      },
    });
  });

  it("галочка «после полуночи» переносит окончание на следующий день", () => {
    const draft = {
      ...createDraft("night", "2026-10-02"),
      startTime: "23:40",
      endTime: "00:15",
      endsNextDay: true,
      amount: "2800",
      commission: "420",
    };
    const result = buildTripFromDraft(draft, TZ);
    expect(result.ok && result.trip.end).toBe("2026-10-03T00:15:00+05:00");
  });

  it("недописанное время, несуществующее время и нечисловые суммы — ошибки у полей", () => {
    const result = buildTripFromDraft(
      { ...createDraft("id", "2026-10-04"), startTime: "12:3", endTime: "25:00", amount: "много" },
      TZ
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        start: "Введите время: ЧЧ:ММ",
        end: "Нет такого времени",
        amount: "Введите сумму числом",
        commission: "Введите комиссию числом",
      },
    });
  });
});

describe("подсказки по времени при вводе", () => {
  const ranges = [
    { from: -30, to: 20 },
    { from: at(12), to: at(12, 25) },
    { from: at(13, 20), to: at(13, 58) },
  ];

  it("пока время не дописано — молчим", () => {
    expect(checkDraftTimes(times("12", ""), ranges)).toEqual({ errors: {} });
  });

  it("начало внутри поездки — занято, и видно какой", () => {
    expect(checkDraftTimes(times("12:10", ""), ranges).errors).toEqual({
      start: "Занято поездкой 12:00–12:25",
    });
    expect(checkDraftTimes(times("00:10", ""), ranges).errors).toEqual({
      start: "Занято поездкой 23:30–00:20",
    });
  });

  it("свободное начало — подсказка, до какого времени можно ехать", () => {
    expect(checkDraftTimes(times("12:30", ""), ranges)).toEqual({
      errors: {},
      endHint: "Свободно до 13:20 — дальше следующая поездка",
    });
    expect(checkDraftTimes(times("20:00", ""), ranges).endHint).toBeUndefined();
  });

  it("окончание, налезающее на следующую поездку", () => {
    expect(checkDraftTimes(times("12:30", "13:30"), ranges).errors).toEqual({
      end: "Пересекается с поездкой 13:20–13:58",
    });
    expect(checkDraftTimes(times("12:30", "13:20"), ranges).errors).toEqual({});
  });

  it("окончание раньше начала — подсказка про полночь", () => {
    expect(checkDraftTimes(times("23:40", "00:15"), ranges).errors.end).toMatch(/после полуночи/);
    expect(checkDraftTimes(times("23:40", "00:15", true), ranges).errors).toEqual({});
  });

  it("несуществующее время", () => {
    expect(checkDraftTimes(times("24:10", "25:00"), ranges).errors).toEqual({
      start: "Нет такого времени",
      end: "Нет такого времени",
    });
  });
});

describe("редактирование", () => {
  const nightTrip = {
    id: "t15",
    start: "2026-10-02T23:40:00+05:00",
    end: "2026-10-03T00:15:00+05:00",
    amount: 2800,
    payment: "cash" as const,
    commission: 420,
  };

  it("форма из ночной поездки: день начала и галочка «после полуночи»", () => {
    expect(draftFromTrip(nightTrip, TZ)).toEqual({
      id: "t15",
      date: "2026-10-02",
      startTime: "23:40",
      endTime: "00:15",
      endsNextDay: true,
      amount: "2800",
      commission: "420",
      payment: "cash",
    });
  });

  it("форма из поездки и обратно даёт ту же поездку", () => {
    expect(buildTripFromDraft(draftFromTrip(nightTrip, TZ), TZ)).toEqual({ ok: true, trip: nightTrip });
  });

  it("время, записанное в UTC, раскладывается по часам бизнеса", () => {
    const draft = draftFromTrip({ ...nightTrip, start: "2026-10-02T18:40:00Z", end: "2026-10-02T19:15:00Z" }, TZ);
    expect([draft.date, draft.startTime, draft.endTime, draft.endsNextDay]).toEqual([
      "2026-10-02",
      "23:40",
      "00:15",
      true,
    ]);
  });

  it("несохранённые изменения: пробелы по краям сумм — не изменение", () => {
    const initial = draftFromTrip(nightTrip, TZ);
    expect(isDraftDirty({ ...initial, amount: " 2800 " }, initial)).toBe(false);
    expect(isDraftDirty({ ...initial, amount: "2900" }, initial)).toBe(true);
    expect(isDraftDirty({ ...initial, endTime: "00:20" }, initial)).toBe(true);
    expect(isDraftDirty({ ...initial, endsNextDay: false }, initial)).toBe(true);
    expect(isDraftDirty({ ...initial, payment: "card" }, initial)).toBe(true);
  });

  it("пустая новая форма — закрыть можно без вопросов", () => {
    const empty = createDraft("id", "2026-10-04");
    expect(isDraftDirty(empty, empty)).toBe(false);
    expect(isDraftDirty({ ...empty, startTime: "1" }, empty)).toBe(true);
  });
});

describe("ввод денег", () => {
  it("пробелы и запятая допустимы", () => {
    expect(parseMoneyInput("1 500,50")).toBe(1500.5);
    expect(parseMoneyInput("2400")).toBe(2400);
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("")).toBeNull();
  });

  it("«на руки» с поездки без хвостов дробей", () => {
    expect(netOfTrip({ amount: 2400, commission: 360 })).toBe(2040);
    expect(netOfTrip({ amount: 0.3, commission: 0.1 })).toBe(0.2);
  });

  it("подсказка комиссии — 15% с копейками", () => {
    expect(suggestCommission("2400")).toBe("360");
    expect(suggestCommission("1999")).toBe("299.85");
    expect(suggestCommission("abc")).toBeNull();
  });
});

describe("ошибки сервера", () => {
  it("попадают к полям формы, незнакомые поля отбрасываются", () => {
    expect(
      mapServerFieldErrors({ amount: "Сумма должна быть больше нуля", id: "плохой номер" })
    ).toEqual({ amount: "Сумма должна быть больше нуля" });
  });
});
