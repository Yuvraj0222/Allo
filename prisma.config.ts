import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL bypasses the Supabase connection pooler.
    // This is required for migrations — pooled connections don't support DDL.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
  adapter: () => {
    const pool = new pg.Pool({
      connectionString: process.env["DATABASE_URL"],
    });
    return new PrismaPg(pool);
  },
});