import { fileURLToPath } from "node:url";
import { parseTzOffset } from "./domain/time";

export interface ServerConfig {
  host: string;
  port: number;
  dataFile: string;
  seedFile: string;
  tzOffsetMinutes: number;
  corsOrigins: readonly string[] | "*";
}

function repoPath(relativePath: string): string {
  return fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));
}

function readPort(text: string | undefined): number {
  const port = Number(text ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT: ожидался номер порта, получено «${text}»`);
  }
  return port;
}

function readTzOffset(text: string | undefined): number {
  const offset = parseTzOffset(text ?? "+05:00");
  if (offset === null) {
    throw new Error(`BUSINESS_TZ_OFFSET: ожидался пояс вида +05:00, получено «${text}»`);
  }
  return offset;
}

function readCorsOrigins(text: string | undefined): readonly string[] | "*" {
  if (!text || text.trim() === "*") return "*";
  return text
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    // Только этот компьютер. Для телефона в той же сети — HOST=0.0.0.0 (см. README)
    host: env.HOST ?? "127.0.0.1",
    port: readPort(env.PORT),
    dataFile: env.DATA_FILE ?? repoPath("data/trips.json"),
    seedFile: env.SEED_FILE ?? repoPath("data/trips.seed.json"),
    tzOffsetMinutes: readTzOffset(env.BUSINESS_TZ_OFFSET),
    corsOrigins: readCorsOrigins(env.CORS_ORIGINS),
  };
}
