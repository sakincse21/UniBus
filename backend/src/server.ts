import app from "./app";
import { env } from "./app/config/env";
import { ensureDataSourceInitialized } from "./app/db/data-source";
import { attachServer, gracefulShutdown } from "./app/utils/globalErrorHandler";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerTrackingSockets } from "./app/modules/tracking/tracking.socket";
import { socketAuth } from "./app/middlewares/socketAuth";
import { setupInitialBatches } from "./app/utils/batchSetup";

async function start() {
  await ensureDataSourceInitialized();
  console.log("✅ PostgreSQL database connected");

  // Setup initial batch data
  await setupInitialBatches();
  console.log("✅ Initial batches created");

  const httpServer = createServer(app);

  // Parse FRONTEND_URL for CORS
  const frontendUrls = env.FRONTEND_URL
    ? env.FRONTEND_URL.split(",").map((url) => url.trim())
    : ["http://localhost:3000"];

  const io = new Server(httpServer, {
    cors: {
      origin: frontendUrls,
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
  });

  io.use(socketAuth);

  app.set("io", io);
  const stopTrackingCleanup = registerTrackingSockets(io);

  httpServer.listen(env.PORT, () =>
    console.log(`🚀 Server running on port ${env.PORT}`),
  );

  attachServer(httpServer);

  const shutdown = (exitCode: number, reason: string) => {
    stopTrackingCleanup();
    io.close();
    void gracefulShutdown(exitCode, reason);
  };

  process.on("SIGTERM", () => shutdown(0, "SIGTERM"));
  process.on("SIGINT", () => shutdown(0, "SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error(err);
    shutdown(1, "uncaughtException");
  });
}

start();
