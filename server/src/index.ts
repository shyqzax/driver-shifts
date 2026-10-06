import { buildApp } from "./app";
import { readConfig } from "./config";
import { JsonFileTripRepository } from "./storage/jsonFileTripRepository";

const config = readConfig();
const repository = await JsonFileTripRepository.open({
  dataFile: config.dataFile,
  seedFile: config.seedFile,
});
const app = await buildApp({
  repository,
  tzOffsetMinutes: config.tzOffsetMinutes,
  corsOrigins: config.corsOrigins,
  logger: true,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
app.log.info(`Данные: ${config.dataFile}`);
