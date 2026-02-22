import "reflect-metadata";
import express from "express";
import cors from "cors";
import router from "./app/routes";
import { errorHandler } from "./app/errors/errorHandler";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: ["http://192.168.10.108:3000", "http://localhost:3000"], // Your Next.js frontend URL
    credentials: true, // Allow credentials (cookies, authorization headers)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", router);

app.use(errorHandler);

export default app;
