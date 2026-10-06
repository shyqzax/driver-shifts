import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Trip } from "../src/domain/trip";
import { JsonFileTripRepository } from "../src/storage/jsonFileTripRepository";
import { InMemoryTripRepository } from "../src/storage/tripRepository";
import { makeTrip } from "./fixtures";
import { makeTestApp, tripsOfDay } from "./helpers";

const DAY = "2026-10-01";

const morning = makeTrip({ id: "morning", start: `${DAY}T09:00:00+05:00`, end: `${DAY}T09:30:00+05:00` });
const noon = makeTrip({ id: "noon", start: `${DAY}T12:00:00+05:00`, end: `${DAY}T12:30:00+05:00` });

function changesOf(trip: Trip): Omit<Trip, "id"> {
  const { id: _id, ...changes } = trip;
  return changes;
}

function putTrip(app: FastifyInstance, id: string, changes: Omit<Trip, "id"> | Record<string, unknown>) {
  return app.inject({ method: "PUT", url: `/v1/trips/${id}`, payload: changes });
}

function deleteTrip(app: FastifyInstance, id: string) {
  return app.inject({ method: "DELETE", url: `/v1/trips/${id}` });
}

describe("изменение поездки", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeTestApp(new InMemoryTripRepository([morning, noon]));
  });

  afterEach(async () => {
    await app.close();
  });

  it("меняет сумму и время, сводка пересчитывается", async () => {
    const changed = { ...changesOf(morning), end: `${DAY}T09:45:00+05:00`, amount: 3000, commission: 450 };

    const response = await putTrip(app, "morning", changed);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ trip: { id: "morning", ...changed }, date: DAY });
    const day = await app.inject({ method: "GET", url: `/v1/days/${DAY}` });
    expect(day.json().summary).toMatchObject({ tripsCount: 2, revenue: 5000 });
  });

  it("своё старое время поездке не мешает: сдвиг внутри себя разрешён", async () => {
    const shifted = { ...changesOf(morning), start: `${DAY}T09:10:00+05:00` };
    expect((await putTrip(app, "morning", shifted)).statusCode).toBe(200);
  });

  it("повтор того же изменения безопасен", async () => {
    const changed = { ...changesOf(morning), amount: 2500 };
    const first = await putTrip(app, "morning", changed);
    const second = await putTrip(app, "morning", changed);
    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect(await tripsOfDay(app, DAY)).toHaveLength(2);
  });

  it("налезть на другую поездку нельзя — 409, данные не меняются", async () => {
    const overlapping = { ...changesOf(morning), end: `${DAY}T12:10:00+05:00` };

    const response = await putTrip(app, "morning", overlapping);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "trip_overlap", conflictingTrip: noon });
    expect(await tripsOfDay(app, DAY)).toEqual([morning, noon]);
  });

  it("проверка данных та же, что при добавлении", async () => {
    const response = await putTrip(app, "morning", { ...changesOf(morning), amount: 0, commission: 0 });
    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({ amount: "Сумма должна быть больше нуля" });
  });

  it("id менять нельзя: лишнее поле в теле — 400", async () => {
    const response = await putTrip(app, "morning", { ...changesOf(morning), id: "other" });
    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({ id: "Лишнее поле" });
  });

  it("несуществующая поездка — 404", async () => {
    const response = await putTrip(app, "ghost", changesOf(morning));
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("trip_not_found");
  });

  it("перенос времени на другой день — поездка уходит в тот день", async () => {
    const moved = {
      ...changesOf(morning),
      start: "2026-10-02T09:00:00+05:00",
      end: "2026-10-02T09:30:00+05:00",
    };

    const response = await putTrip(app, "morning", moved);

    expect(response.json().date).toBe("2026-10-02");
    expect((await tripsOfDay(app, DAY)).map((trip) => trip.id)).toEqual(["noon"]);
    expect((await tripsOfDay(app, "2026-10-02")).map((trip) => trip.id)).toEqual(["morning"]);
  });
});

describe("удаление поездки", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeTestApp(new InMemoryTripRepository([morning, noon]));
  });

  afterEach(async () => {
    await app.close();
  });

  it("удаляет, и время освобождается для новой поездки", async () => {
    expect((await deleteTrip(app, "noon")).statusCode).toBe(204);
    expect((await tripsOfDay(app, DAY)).map((trip) => trip.id)).toEqual(["morning"]);

    const replacement = makeTrip({ id: "replacement", start: noon.start, end: noon.end });
    const created = await app.inject({ method: "POST", url: "/v1/trips", payload: replacement });
    expect(created.statusCode).toBe(201);
  });

  it("повторное удаление — 404: клиент понимает, что поездки уже нет", async () => {
    await deleteTrip(app, "noon");
    const again = await deleteTrip(app, "noon");
    expect(again.statusCode).toBe(404);
    expect(again.json().code).toBe("trip_not_found");
  });
});

describe("изменение и удаление сохраняются в файл", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "driver-shifts-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("после перезапуска видны изменённая поездка и нет удалённой", async () => {
    const dataFile = join(directory, "trips.json");
    const before = await makeTestApp(await JsonFileTripRepository.open({ dataFile }));
    for (const trip of [morning, noon]) {
      await before.inject({ method: "POST", url: "/v1/trips", payload: trip });
    }
    await putTrip(before, "morning", { ...changesOf(morning), amount: 2700 });
    await deleteTrip(before, "noon");
    await before.close();

    const after = await makeTestApp(await JsonFileTripRepository.open({ dataFile }));

    expect(await tripsOfDay(after, DAY)).toEqual([{ ...morning, amount: 2700 }]);
    await after.close();
  });
});

describe("CORS для веб-клиента", () => {
  it("браузеру разрешены PUT и DELETE", async () => {
    const app = await makeTestApp();
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/v1/trips/morning",
      headers: {
        origin: "http://localhost:8081",
        "access-control-request-method": "DELETE",
      },
    });
    expect(preflight.headers["access-control-allow-methods"]).toContain("PUT");
    expect(preflight.headers["access-control-allow-methods"]).toContain("DELETE");
    await app.close();
  });
});
