import "reflect-metadata";
import express from "express";
import cors from "cors";
import router from "./app/routes";
import { errorHandler } from "./app/errors/errorHandler";
import cookieParser from "cookie-parser";
import { ensureDataSourceInitialized } from "./app/db/data-source";

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);
app.use(express.json());
app.use(cookieParser());

// Needed for serverless runtimes (e.g. Vercel) where app.ts is the entrypoint.
app.use(async (_req, _res, next) => {
  try {
    await ensureDataSourceInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api/v1", router);

app.use(errorHandler);

export default app;
