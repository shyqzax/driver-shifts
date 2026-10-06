import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryTripRepository } from "../src/storage/tripRepository";
import { makeTrip, TASK_EXAMPLE_TRIPS } from "./fixtures";
import { makeTestApp, postTrip } from "./helpers";

describe("API дня", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const lateTrip = makeTrip({
      id: "late",
      start: "2026-10-01T23:40:00+05:00",
      end: "2026-10-02T00:10:00+05:00",
    });
    // Порядок нарочно перепутан: сервер обязан отсортировать по времени начала
    app = await makeTestApp(
      new InMemoryTripRepository([lateTrip, TASK_EXAMPLE_TRIPS[1]!, TASK_EXAMPLE_TRIPS[0]!])
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it("отдаёт поездки дня по порядку и сводку", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/days/2026-10-01" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.date).toBe("2026-10-01");
    expect(body.tzOffset).toBe("+05:00");
    expect(body.trips.map((trip: { id: string }) => trip.id)).toEqual(["t1", "t2", "late"]);
    expect(body.summary).toMatchObject({ tripsCount: 3, revenue: 5900, commission: 885, net: 5015 });
  });

  it("поездка через полночь не попадает в следующий день", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/days/2026-10-02" });
    expect(response.json()).toMatchObject({ trips: [], summary: { tripsCount: 0, revenue: 0 } });
  });

  it("занятое время: ночная поездка вчера и утро завтра попадают, дальние дни — нет", async () => {
    const yesterdayNight = makeTrip({
      id: "yesterday-night",
      start: "2026-09-30T23:30:00+05:00",
      end: "2026-10-01T00:20:00+05:00",
    });
    const yesterdayEvening = makeTrip({
      id: "yesterday-evening",
      start: "2026-09-30T20:00:00+05:00",
      end: "2026-09-30T20:30:00+05:00",
    });
    const tomorrowMorning = makeTrip({
      id: "tomorrow-morning",
      start: "2026-10-02T07:00:00+05:00",
      end: "2026-10-02T07:30:00+05:00",
    });
    const dayAfterTomorrow = makeTrip({
      id: "day-after",
      start: "2026-10-03T07:00:00+05:00",
      end: "2026-10-03T07:30:00+05:00",
    });
    const appWithNeighbours = await makeTestApp(
      new InMemoryTripRepository([
        tomorrowMorning,
        TASK_EXAMPLE_TRIPS[0]!,
        yesterdayNight,
        yesterdayEvening,
        dayAfterTomorrow,
      ])
    );

    const response = await appWithNeighbours.inject({ method: "GET", url: "/v1/days/2026-10-01" });

    expect(response.json().busy).toEqual([
      { tripId: "yesterday-night", start: yesterdayNight.start, end: yesterdayNight.end },
      { tripId: "t1", start: TASK_EXAMPLE_TRIPS[0]!.start, end: TASK_EXAMPLE_TRIPS[0]!.end },
      { tripId: "tomorrow-morning", start: tomorrowMorning.start, end: tomorrowMorning.end },
    ]);
    // Ночная поездка вчерашнего дня занимает время, но в список поездок дня не входит
    expect(response.json().trips.map((trip: { id: string }) => trip.id)).toEqual(["t1"]);
    await appWithNeighbours.close();
  });

  it("список дней с поездками", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/days" });
    expect(response.json()).toEqual([{ date: "2026-10-01", tripsCount: 3 }]);
  });

  it.each(["2026-13-40", "2026-02-30", "вчера"])("кривая дата %s — 400", async (date) => {
    const response = await app.inject({ method: "GET", url: `/v1/days/${encodeURIComponent(date)}` });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("invalid_date");
  });
});

describe("API добавления: ошибки данных", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("сумма 0 и окончание раньше начала — 400 с ошибками у обоих полей", async () => {
    const response = await postTrip(
      app,
      makeTrip({ amount: 0, commission: 0, end: "2026-10-01T09:00:00+05:00" })
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "validation_failed",
      fields: {
        amount: "Сумма должна быть больше нуля",
        end: "Окончание должно быть позже начала",
      },
    });
  });

  it("сумма строкой не превращается в число молча", async () => {
    const response = await postTrip(app, { ...makeTrip(), amount: "2400" });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({ amount: "Неверный тип: нужно число" });
  });

  it("пропущенное и лишнее поле — 400 с названиями полей", async () => {
    const { commission: _omitted, ...withoutCommission } = makeTrip();

    const response = await postTrip(app, { ...withoutCommission, driverName: "Иван" });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({
      commission: "Обязательное поле",
      driverName: "Лишнее поле",
    });
  });

  it("битый JSON — 400, а не 500", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: { "content-type": "application/json" },
      payload: "{ не json",
    });
    expect(response.statusCode).toBe(400);
  });

  it("отклонённая поездка не сохраняется", async () => {
    await postTrip(app, makeTrip({ amount: -1 }));
    const day = await app.inject({ method: "GET", url: "/v1/days/2026-10-01" });
    expect(day.json().trips).toEqual([]);
  });
});
