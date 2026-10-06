import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonFileTripRepository } from "../src/storage/jsonFileTripRepository";
import { makeTrip } from "./fixtures";
import { makeTestApp, postTrip, tripsOfDay } from "./helpers";

const DAY = "2026-10-01";

describe("защита от дублей", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("повторная отправка той же поездки не создаёт дубль", async () => {
    const trip = makeTrip({ id: "abc" });

    const first = await postTrip(app, trip);
    const second = await postTrip(app, trip);

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ created: true, trip });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ created: false, trip });
    expect(await tripsOfDay(app, DAY)).toHaveLength(1);
  });

  it("две одновременные отправки (двойной тап) — одна поездка", async () => {
    const trip = makeTrip({ id: "double-tap" });

    const responses = await Promise.all([postTrip(app, trip), postTrip(app, trip)]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 201]);
    expect(await tripsOfDay(app, DAY)).toHaveLength(1);
  });

  it("повтор, записанный в другом поясе и с .00 в сумме, — всё равно повтор", async () => {
    await postTrip(app, makeTrip({ id: "same", start: "2026-10-01T10:00:00+05:00", amount: 2000 }));

    const replay = await postTrip(app, {
      ...makeTrip({ id: "same" }),
      start: "2026-10-01T05:00:00Z",
      amount: 2000.0,
    });

    expect(replay.statusCode).toBe(200);
    expect(await tripsOfDay(app, DAY)).toHaveLength(1);
  });

  it("тот же id с другими данными — 409, записанная поездка не меняется", async () => {
    const original = makeTrip({ id: "abc", amount: 2000 });
    await postTrip(app, original);

    const conflict = await postTrip(app, { ...original, amount: 9000 });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: "trip_id_conflict", existingTrip: original });
    expect(await tripsOfDay(app, DAY)).toEqual([original]);
  });

  it("та же поездка под новым id (клиент потерял id) — 409 из-за пересечения", async () => {
    const original = makeTrip({ id: "first-id" });
    await postTrip(app, original);

    const resent = await postTrip(app, { ...original, id: "second-id" });

    expect(resent.statusCode).toBe(409);
    expect(resent.json()).toMatchObject({ code: "trip_overlap", conflictingTrip: original });
    expect(await tripsOfDay(app, DAY)).toHaveLength(1);
  });

  it("частичное пересечение по времени тоже отклоняется", async () => {
    await postTrip(app, makeTrip({ id: "a", start: `${DAY}T10:00:00+05:00`, end: `${DAY}T10:30:00+05:00` }));

    const overlapping = await postTrip(
      app,
      makeTrip({ id: "b", start: `${DAY}T10:29:00+05:00`, end: `${DAY}T10:50:00+05:00` })
    );

    expect(overlapping.statusCode).toBe(409);
    expect(overlapping.json().code).toBe("trip_overlap");
  });

  it("поездки встык (конец одной = начало другой) обе принимаются", async () => {
    const first = await postTrip(
      app,
      makeTrip({ id: "a", start: `${DAY}T10:00:00+05:00`, end: `${DAY}T10:30:00+05:00` })
    );
    const second = await postTrip(
      app,
      makeTrip({ id: "b", start: `${DAY}T10:30:00+05:00`, end: `${DAY}T10:45:00+05:00` })
    );

    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    expect(await tripsOfDay(app, DAY)).toHaveLength(2);
  });
});

describe("защита от дублей переживает перезапуск сервера", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "driver-shifts-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("поездка сохранена в файл, и повтор после перезапуска не создаёт дубль", async () => {
    const dataFile = join(directory, "trips.json");
    const trip = makeTrip({ id: "persisted" });

    const appBeforeRestart = await makeTestApp(await JsonFileTripRepository.open({ dataFile }));
    expect((await postTrip(appBeforeRestart, trip)).statusCode).toBe(201);
    await appBeforeRestart.close();

    const appAfterRestart = await makeTestApp(await JsonFileTripRepository.open({ dataFile }));
    const replay = await postTrip(appAfterRestart, trip);

    expect(replay.statusCode).toBe(200);
    expect(await tripsOfDay(appAfterRestart, DAY)).toEqual([trip]);
    await appAfterRestart.close();
  });
});
