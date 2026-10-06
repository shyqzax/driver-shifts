import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "./apiError";

export const VALIDATION_FAILED_MESSAGE = "Проверьте поля поездки";

type SchemaErrors = NonNullable<FastifyError["validation"]>;

const TYPE_NAMES: Record<string, string> = {
  number: "число",
  string: "строка",
  object: "объект",
};

function describeSchemaError(error: SchemaErrors[number]): { field: string; message: string } {
  const params = error.params as Record<string, unknown>;
  const pathField = error.instancePath.replace(/^\//, "");

  if (error.keyword === "required" && typeof params.missingProperty === "string") {
    return { field: params.missingProperty, message: "Обязательное поле" };
  }
  if (error.keyword === "additionalProperties" && typeof params.additionalProperty === "string") {
    return { field: params.additionalProperty, message: "Лишнее поле" };
  }
  if (error.keyword === "type" && typeof params.type === "string") {
    const typeName = TYPE_NAMES[params.type] ?? params.type;
    return { field: pathField || "body", message: `Неверный тип: нужно ${typeName}` };
  }
  return { field: pathField || "body", message: "Неверное значение" };
}

/**
 * Ошибки схемы приходят в том же виде, что и ошибки бизнес-правил
 * (`validation_failed` + `fields`): форме клиента не важно, кто нашёл ошибку.
 */
function schemaErrorsToFields(errors: SchemaErrors): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const error of errors) {
    const { field, message } = describeSchemaError(error);
    fields[field] ??= message;
  }
  return fields;
}

export function handleError(
  error: FastifyError | ApiError,
  request: FastifyRequest,
  reply: FastifyReply
): FastifyReply {
  if (error instanceof ApiError) {
    return reply.code(error.statusCode).send({ code: error.code, message: error.message });
  }
  if (error.validation) {
    return reply.code(400).send({
      code: "validation_failed",
      message: VALIDATION_FAILED_MESSAGE,
      fields: schemaErrorsToFields(error.validation),
    });
  }
  if (typeof error.statusCode === "number" && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ code: "bad_request", message: error.message });
  }

  request.log.error({ err: error }, "unhandled error");
  return reply.code(500).send({ code: "internal", message: "Внутренняя ошибка сервера" });
}
