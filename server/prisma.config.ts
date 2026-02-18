import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL?.trim() || "file:./prisma/dev.db";

const databaseProvider = (() => {
  const explicit = process.env.DATABASE_PROVIDER?.trim().toLowerCase();
  if (explicit === "postgresql" || explicit === "sqlite") {
    return explicit;
  }
  return databaseUrl.startsWith("file:") ? "sqlite" : "postgresql";
})();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasources: {
    db: {
      provider: databaseProvider as "sqlite" | "postgresql",
      url: databaseUrl,
    },
  },
});
