import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { isValidDayKey } from "../domain/businessDay";
import type { Trip } from "../domain/trip";
import { ApiError } from "../http/apiError";
import { VALIDATION_FAILED_MESSAGE } from "../http/errorHandler";
import type {
  AddTripOutcome,
  TripChanges,
  TripService,
  UpdateTripOutcome,
} from "../services/tripService";

export interface TripRoutesOptions {
  tripService: TripService;
}

/** Схема проверяет только форму запроса. Смысл (сумма > 0, конец позже начала) — в validateTrip. */
const tripBodySchema = {
  type: "object",
  required: ["id", "start", "end", "amount", "payment", "commission"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    amount: { type: "number" },
    payment: { type: "string" },
    commission: { type: "number" },
  },
} as const;

/** Изменение: те же поля, но без id — он берётся из адреса и меняться не может. */
const tripChangesSchema = {
  type: "object",
  required: ["start", "end", "amount", "payment", "commission"],
  additionalProperties: false,
  properties: {
    start: { type: "string" },
    end: { type: "string" },
    amount: { type: "number" },
    payment: { type: "string" },
    commission: { type: "number" },
  },
} as const;

const tripParamsSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } },
} as const;

const TRIP_NOT_FOUND = { code: "trip_not_found", message: "Поездка не найдена — возможно, её уже удалили" };

const dayParamsSchema = {
  type: "object",
  required: ["date"],
  properties: { date: { type: "string" } },
} as const;

function sendAddTripOutcome(reply: FastifyReply, outcome: AddTripOutcome): FastifyReply {
  switch (outcome.kind) {
    case "created":
      return reply.code(201).send({ trip: outcome.trip, date: outcome.date, created: true });
    case "replayed":
      return reply.code(200).send({ trip: outcome.trip, date: outcome.date, created: false });
    case "invalid":
      return reply.code(400).send({
        code: "validation_failed",
        message: VALIDATION_FAILED_MESSAGE,
        fields: outcome.fieldErrors,
      });
    case "id_conflict":
      return reply.code(409).send({
        code: "trip_id_conflict",
        message: "Поездка с таким id уже есть, но с другими данными",
        existingTrip: outcome.existingTrip,
      });
    case "overlap":
      return reply.code(409).send({
        code: "trip_overlap",
        message: "Поездка пересекается по времени с уже записанной",
        conflictingTrip: outcome.conflictingTrip,
      });
  }
}

function sendUpdateTripOutcome(reply: FastifyReply, outcome: UpdateTripOutcome): FastifyReply {
  switch (outcome.kind) {
    case "updated":
      return reply.code(200).send({ trip: outcome.trip, date: outcome.date });
    case "not_found":
      return reply.code(404).send(TRIP_NOT_FOUND);
    case "invalid":
      return reply.code(400).send({
        code: "validation_failed",
        message: VALIDATION_FAILED_MESSAGE,
        fields: outcome.fieldErrors,
      });
    case "overlap":
      return reply.code(409).send({
        code: "trip_overlap",
        message: "Поездка пересекается по времени с уже записанной",
        conflictingTrip: outcome.conflictingTrip,
      });
  }
}

export const tripRoutes: FastifyPluginAsync<TripRoutesOptions> = async (app, { tripService }) => {
  app.get("/v1/days", async () => tripService.listDays());

  app.get<{ Params: { date: string } }>(
    "/v1/days/:date",
    { schema: { params: dayParamsSchema } },
    async (request) => {
      const { date } = request.params;
      if (!isValidDayKey(date)) {
        throw new ApiError(400, "invalid_date", "Дата должна быть в формате ГГГГ-ММ-ДД");
      }
      return tripService.getDay(date);
    }
  );

  app.post<{ Body: Trip }>(
    "/v1/trips",
    { schema: { body: tripBodySchema } },
    async (request, reply) => sendAddTripOutcome(reply, await tripService.addTrip(request.body))
  );

  app.put<{ Params: { id: string }; Body: TripChanges }>(
    "/v1/trips/:id",
    { schema: { params: tripParamsSchema, body: tripChangesSchema } },
    async (request, reply) =>
      sendUpdateTripOutcome(reply, await tripService.updateTrip(request.params.id, request.body))
  );

  app.delete<{ Params: { id: string } }>(
    "/v1/trips/:id",
    { schema: { params: tripParamsSchema } },
    async (request, reply) => {
      const outcome = await tripService.deleteTrip(request.params.id);
      if (outcome.kind === "not_found") return reply.code(404).send(TRIP_NOT_FOUND);
      return reply.code(204).send();
    }
  );
};
