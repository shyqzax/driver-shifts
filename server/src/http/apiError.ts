/** Ошибка с HTTP-статусом и машинным кодом: клиент ветвится по `code`, а не по тексту. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
