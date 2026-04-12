import { AppDataSource } from "../db/data-source";

let serverRef: any = null;
let shuttingDown = false;

export function attachServer(server: any) {
  serverRef = server;
}

export async function gracefulShutdown(exitCode = 0, reason = "unspecified") {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Graceful shutdown: ${reason}`);

  try {
    if (serverRef) {
      await new Promise<void>((resolve, reject) => {
        serverRef.close((err: any) => (err ? reject(err) : resolve()));
      });
      console.log("HTTP server closed");
    }

    if (AppDataSource && AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log("DB destroyed");
    }

    // add redis/other cleanup here
    process.exit(exitCode);
  } catch (err) {
    console.error("Shutdown error:", err);
    process.exit(1);
  }
}
