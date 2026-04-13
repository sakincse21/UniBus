import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES: process.env.JWT_EXPIRES || "7d",
  BCRYPT_SALT: Number(process.env.BCRYPT_SALT || 10),
  MYSQL_HOST: process.env.MYSQL_HOST || "localhost",
  MYSQL_PORT: Number(process.env.MYSQL_PORT || 3306),
  MYSQL_USER: process.env.MYSQL_USER || "root",
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || "",
  MYSQL_DB: process.env.MYSQL_DB || "test_db",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "noreply@unibus.com",
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || "",
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "nvidia/nemotron-nano-12b-v2-vl:free",
};
