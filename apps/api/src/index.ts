import { config } from "./core/config.js";
import { createServer } from "./server.js";

const server = createServer();

try {
  await server.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
