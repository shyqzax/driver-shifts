import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import type { Trip } from "../src/domain/trip";
import { InMemoryTripRepository, type TripRepository } from "../src/storage/tripRepository";
import { BUSINESS_TZ_OFFSET_MINUTES } from "./fixtures";

export function makeTestApp(
  repository: TripRepository = new InMemoryTripRepository()
): Promise<FastifyInstance> {
  return buildApp({ repository, tzOffsetMinutes: BUSINESS_TZ_OFFSET_MINUTES });
}

export function postTrip(app: FastifyInstance, body: Partial<Trip> | Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/v1/trips", payload: body });
}

export async function tripsOfDay(app: FastifyInstance, date: string): Promise<Trip[]> {
  const response = await app.inject({ method: "GET", url: `/v1/days/${date}` });
  return response.json<{ trips: Trip[] }>().trips;
}
