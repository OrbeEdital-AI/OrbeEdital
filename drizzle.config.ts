import { defineConfig } from "drizzle-kit";

// `generate` reads schema metadata only. Runtime DB access and migrations use
// `server/db.ts`, which enforces the external Supabase CA and verify-full.
const connectionString = process.env.LICITAHUB_POSTGRES_URL ?? "postgresql://localhost/orbeedital";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
  strict: true,
  verbose: true,
});
