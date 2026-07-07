import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  PORT: Number(process.env.PORT ?? 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  SUPER_ADMIN_EMAILS: (process.env.SUPER_ADMIN_EMAILS ?? "tnicodemos@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? "",
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? "/app/uploads",
};