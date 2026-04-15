import app from "./app";
import { env } from "./app/config/env";
import { ensureDataSourceInitialized } from "./app/db/data-source";
import { attachServer, gracefulShutdown } from "./app/utils/globalErrorHandler";
import { createServer } from "http";
import { Server } from "socket.io";
import { startCronJobs } from "./app/modules/notification/push.cron";
import { registerTrackingSockets } from "./app/modules/tracking/tracking.socket";
import { socketAuth } from "./app/middlewares/socketAuth";

async function start() {
  await ensureDataSourceInitialized();
  console.log("Database connected");

  // const server = app.listen(env.PORT, () =>
  //   console.log(`Server running on port ${env.PORT}`)
  // );

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(socketAuth);

  app.set("io", io);
  const stopTrackingCleanup = registerTrackingSockets(io);
  const stopCronJobs = startCronJobs();

  httpServer.listen(env.PORT, () =>
    console.log(`Server running on port ${env.PORT}`),
  );

  // attachServer(server);
  attachServer(httpServer);

  const shutdown = (exitCode: number, reason: string) => {
    stopTrackingCleanup();
    stopCronJobs();
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
