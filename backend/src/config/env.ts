import dotenv from "dotenv";

dotenv.config();
if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 32 || /nsupure_.*(secret|2025)/i.test(secret)) {
    throw new Error("Production requires a unique JWT_SECRET of at least 32 characters.");
  }
  if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
    throw new Error("Production requires persistent PostgreSQL storage; local SQLite is not allowed.");
  }
}

export const ENV = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  JWT_SECRET: process.env.JWT_SECRET || "nsupure_fallback_dev_secret_key_2025",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  UPLOAD_DIR: process.env.UPLOAD_DIR || "./uploads",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY || "GHS",
};
