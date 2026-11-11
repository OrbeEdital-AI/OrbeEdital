import { createHash, X509Certificate } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../drizzle/schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let database: Database | null = null;

/**
 * The WebDev secret injector may flatten line breaks in PEM environment values.
 * Extract and re-encode the X.509 DER in memory so OpenSSL always receives a
 * canonical PEM. The certificate contents are never written to disk or logged.
 */
export function normalizeSupabaseCa(raw = process.env.LICITAHUB_POSTGRES_CA_CERT ?? ""): string {
  const blocks = [...raw.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)];
  if (blocks.length === 0) throw new Error("PostgreSQL CA certificate is missing or malformed");

  const normalized = blocks.map((block) => {
    const body = block[1].replace(/\s+/g, "");
    if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
      throw new Error("PostgreSQL CA certificate is not valid base64 PEM");
    }
    const der = Buffer.from(body, "base64");
    if (!der.length || der.toString("base64").replace(/=+$/, "") !== body.replace(/=+$/, "")) {
      throw new Error("PostgreSQL CA certificate could not be decoded");
    }
    const certificate = new X509Certificate(der);
    if (!certificate.ca) throw new Error("PostgreSQL trust certificate is not a CA");
    if (Date.parse(certificate.validFrom) > Date.now() || Date.parse(certificate.validTo) <= Date.now()) {
      throw new Error("PostgreSQL CA certificate is outside its validity period");
    }
    const base64 = der.toString("base64").match(/.{1,64}/g)?.join("\n");
    if (!base64) throw new Error("PostgreSQL CA certificate is empty");
    return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
  });

  return `${normalized.join("\n")}\n`;
}

function getConnectionString(): string {
  const raw = process.env.LICITAHUB_POSTGRES_URL;
  if (!raw) throw new Error("LICITAHUB_POSTGRES_URL is not configured");
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error("LICITAHUB_POSTGRES_URL must be a PostgreSQL URI");
  }
  // TLS is configured below with the project CA. Remove URI TLS parameters
  // which would override the explicit CA and hostname validation options in pg.
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(key);
  return url.toString();
}

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = getConnectionString();
  const ca = normalizeSupabaseCa();
  const config: PoolConfig = {
    connectionString,
    ssl: { ca, rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "orbeedital",
  };
  pool = new Pool(config);
  pool.on("error", (error: NodeJS.ErrnoException) => {
    const code = error.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "UNCLASSIFIED";
    console.error("[PostgreSQL] idle pool error", code);
  });
  return pool;
}

export function getDb(): Database {
  if (!database) database = drizzle(getPool(), { schema });
  return database;
}

export async function verifyPostgresConnection(): Promise<void> {
  await getPool().query("SELECT 1");
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
  database = null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
