import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabase, getDb, verifyPostgresConnection } from "./db";

async function main() {
  try {
    // Fail closed: no DDL unless an authenticated TLS connection succeeds first.
    await verifyPostgresConnection();
    console.log("PostgreSQL authenticated TLS connection verified; applying migrations.");
    await migrate(getDb(), { migrationsFolder: "./drizzle/postgres" });
    console.log("PostgreSQL migrations complete.");
  } finally {
    await closeDatabase();
  }
}

main().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
    ? error.code
    : "UNCLASSIFIED";
  console.error("PostgreSQL migration failed", code);
  process.exitCode = 1;
});
