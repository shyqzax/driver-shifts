import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { handleError } from "./http/errorHandler";
import { tripRoutes } from "./routes/trips";
import { TripService } from "./services/tripService";
import type { TripRepository } from "./storage/tripRepository";

export interface AppOptions {
  repository: TripRepository;
  tzOffsetMinutes: number;
  /** Список адресов веб-клиента или `*` — разрешить любой */
  corsOrigins?: readonly string[] | "*";
  logger?: boolean;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    ajv: {
      customOptions: {
        // По умолчанию Fastify превращает "2400" в 2400 и молча выкидывает
        // лишние поля. Для денег это опасно: пусть клиент узнает об ошибке.
        coerceTypes: false,
        removeAdditional: false,
        allErrors: true,
      },
    },
  });

  const corsOrigins = options.corsOrigins ?? "*";
  await app.register(cors, {
    origin: corsOrigins === "*" ? true : [...corsOrigins],
    // По умолчанию плагин разрешает браузеру только GET/HEAD/POST — изменение и удаление не прошли бы
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE"],
  });

  app.setErrorHandler(handleError);
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ code: "not_found", message: "Нет такого адреса" })
  );

  app.get("/healthz", async () => ({ status: "ok" }));

  const tripService = new TripService(options.repository, options.tzOffsetMinutes);
  await app.register(tripRoutes, { tripService });

  return app;
}
