import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { Server } from "socket.io";
import { getConfig } from "@/lib/config";
import { initializeDatabase } from "@/lib/db";
import { initializeLiveState } from "@/lib/state/live";
import { registerSocketServer } from "@/lib/socket/server";

loadEnvConfig(process.cwd());

const config = getConfig();
const dev = config.nodeEnv !== "production";
const app = next({ dev, hostname: config.host, port: config.port });
const handle = app.getRequestHandler();

async function bootstrap() {
  initializeDatabase();
  initializeLiveState();

  await app.prepare();

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url ?? "/", true);
    void handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/api/socket",
    serveClient: false,
    cors: {
      origin: true,
      credentials: true
    }
  });

  registerSocketServer(io);

  httpServer.listen(config.port, config.host, () => {
    console.log(`${config.appName} listening on http://${config.host}:${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
