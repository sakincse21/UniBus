import "reflect-metadata";
import express from "express";
import cors from "cors";
import router from "./app/routes";
import { errorHandler } from "./app/errors/errorHandler";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: [
      "http://192.168.10.108:3000",
      "http://localhost:3000",
      "http://localhost:8081",
      "http://192.168.1.10:3000",
      "http://192.168.1.7:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", router);

app.use(errorHandler);

export default app;
