import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES: process.env.JWT_EXPIRES || "7d",
  BCRYPT_SALT: Number(process.env.BCRYPT_SALT || 10),
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

  // PostgreSQL Configuration
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: Number(process.env.DB_PORT || 5432),
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "tracku_db",

  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "noreply@tracku.com",
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || "",
  OPENROUTER_MODEL:
    process.env.OPENROUTER_MODEL || "nvidia/nemotron-nano-12b-v2-vl:free",
};
