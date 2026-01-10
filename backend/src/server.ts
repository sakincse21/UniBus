import app from "./app";
import { env } from "./app/config/env";
import { AppDataSource } from "./app/db/data-source";
import { attachServer, gracefulShutdown } from "./app/utils/globalErrorHandler";

async function start() {
  await AppDataSource.initialize();
  console.log("Database connected");

  const server = app.listen(env.PORT, () => console.log(`Server running on port ${env.PORT}`));

  attachServer(server);

  process.on("SIGINT", () => gracefulShutdown(0, "SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error(err);
    gracefulShutdown(1, "uncaughtException");
  });
}

start();
