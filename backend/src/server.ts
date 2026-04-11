import app from "./app";
import { env } from "./app/config/env";
import { AppDataSource } from "./app/db/data-source";
import { attachServer, gracefulShutdown } from "./app/utils/globalErrorHandler";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerTrackingSockets } from "./app/modules/tracking/tracking.socket";
import { socketAuth } from "./app/middlewares/socketAuth";

async function start() {
  await AppDataSource.initialize();
  console.log("Database connected");

  // const server = app.listen(env.PORT, () =>
  //   console.log(`Server running on port ${env.PORT}`)
  // );

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: [
        "http://192.168.10.108:3000",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://192.168.1.10:3000",
        "http://192.168.1.7:3000",
        "http://192.168.10.191:8081",
        "http://192.168.10.119:8081",
        "http://192.168.10.249:8081",
      ],
      credentials: true,
    },
  });

  io.use(socketAuth);

  app.set("io", io);
  registerTrackingSockets(io);

  httpServer.listen(env.PORT, () =>
    console.log(`Server running on port ${env.PORT}`),
  );

  // attachServer(server);
  attachServer(httpServer);

  process.on("SIGTERM", () => gracefulShutdown(0, "SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown(0, "SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error(err);
    gracefulShutdown(1, "uncaughtException");
  });
}

start();
