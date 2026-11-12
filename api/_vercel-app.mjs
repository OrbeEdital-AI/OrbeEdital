var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/vercel-app.ts
import express from "express";
import { parse as parseCookieHeader4 } from "cookie";
import * as cookieModule from "cookie";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/auth.ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { and, eq, gt } from "drizzle-orm";

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  alerts: () => alerts,
  auditLogs: () => auditLogs,
  authSessions: () => authSessions,
  companies: () => companies,
  companyMembers: () => companyMembers,
  companyProfiles: () => companyProfiles,
  connectors: () => connectors,
  emailVerifications: () => emailVerifications,
  favorites: () => favorites,
  followedOpportunities: () => followedOpportunities,
  notifications: () => notifications,
  opportunities: () => opportunities,
  opportunityActivities: () => opportunityActivities,
  opportunityHistory: () => opportunityHistory,
  opportunityItems: () => opportunityItems,
  passwordResetTokens: () => passwordResetTokens,
  payments: () => payments,
  pipelineStatusEnum: () => pipelineStatusEnum,
  plans: () => plans,
  savedSearches: () => savedSearches,
  subscriptions: () => subscriptions,
  syncRuns: () => syncRuns,
  userRoleEnum: () => userRoleEnum,
  users: () => users
});
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
var userRoleEnum = pgEnum("user_role", [
  "user",
  "superadmin",
  "admin",
  "source_operator",
  "support",
  "finance"
]);
var pipelineStatusEnum = pgEnum("pipeline_status", [
  "new",
  "analysis",
  "interesting",
  "docs",
  "proposal_sent",
  "participating",
  "won",
  "lost",
  "discarded"
]);
var timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};
var users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: varchar("phone", { length: 40 }),
    role: userRoleEnum("role").default("user").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastSignedIn: timestamp("last_signed_in", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email), index("users_role_idx").on(table.role)]
);
var companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalName: text("legal_name").notNull(),
    cnpj: varchar("cnpj", { length: 18 }),
    state: varchar("state", { length: 2 }),
    municipality: text("municipality"),
    primarySegment: text("primary_segment"),
    ...timestamps
  },
  (table) => [uniqueIndex("companies_cnpj_unique").on(table.cnpj)]
);
var companyMembers = pgTable(
  "company_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    memberRole: text("member_role").default("owner").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("company_members_company_user_unique").on(table.companyId, table.userId)]
);
var companyProfiles = pgTable(
  "company_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().unique().references(() => companies.id, { onDelete: "cascade" }),
    segments: jsonb("segments").$type().notNull().default([]),
    products: jsonb("products").$type().notNull().default([]),
    services: jsonb("services").$type().notNull().default([]),
    keywords: jsonb("keywords").$type().notNull().default([]),
    servedStates: jsonb("served_states").$type().notNull().default([]),
    servedMunicipalities: jsonb("served_municipalities").$type().notNull().default([]),
    minimumValue: numeric("minimum_value", { precision: 16, scale: 2 }),
    maximumValue: numeric("maximum_value", { precision: 16, scale: 2 }),
    catmatCodes: jsonb("catmat_codes").$type().notNull().default([]),
    catserCodes: jsonb("catser_codes").$type().notNull().default([]),
    notificationPreferences: jsonb("notification_preferences").$type().notNull().default({}),
    ...timestamps
  }
);
var authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("auth_sessions_user_idx").on(table.userId), index("auth_sessions_expiry_idx").on(table.expiresAt)]
);
var connectors = pgTable(
  "connectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 80 }).notNull().unique(),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    integrationType: text("integration_type").default("official_api").notNull(),
    status: text("status").default("pending").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    frequencySeconds: integer("frequency_seconds").default(3600).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    importedCount: integer("imported_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    averageDurationMs: integer("average_duration_ms"),
    lastError: text("last_error"),
    configuration: jsonb("configuration").$type().notNull().default({}),
    ...timestamps
  },
  (table) => [index("connectors_status_idx").on(table.status, table.enabled)]
);
var syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectorId: uuid("connector_id").notNull().references(() => connectors.id, { onDelete: "cascade" }),
    status: text("status").default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    fetchedCount: integer("fetched_count").default(0).notNull(),
    insertedCount: integer("inserted_count").default(0).notNull(),
    updatedCount: integer("updated_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    errorSummary: text("error_summary"),
    cursor: text("cursor"),
    metadata: jsonb("metadata").$type().notNull().default({})
  },
  (table) => [index("sync_runs_connector_started_idx").on(table.connectorId, table.startedAt)]
);
var opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectorId: uuid("connector_id").notNull().references(() => connectors.id, { onDelete: "restrict" }),
    sourceKey: varchar("source_key", { length: 300 }).notNull(),
    controlNumber: text("control_number"),
    procurementNumber: text("procurement_number"),
    processNumber: text("process_number"),
    year: integer("year"),
    modality: text("modality"),
    procurementType: text("procurement_type"),
    title: text("title").notNull(),
    description: text("description"),
    summary: text("summary"),
    agencyName: text("agency_name"),
    unitName: text("unit_name"),
    agencyCnpj: varchar("agency_cnpj", { length: 18 }),
    state: varchar("state", { length: 2 }),
    municipality: text("municipality"),
    address: text("address"),
    publicationDate: timestamp("publication_date", { withTimezone: true }),
    openingDate: timestamp("opening_date", { withTimezone: true }),
    sessionAt: timestamp("session_at", { withTimezone: true }),
    proposalDeadline: timestamp("proposal_deadline", { withTimezone: true }),
    estimatedValue: numeric("estimated_value", { precision: 18, scale: 2 }),
    awardedValue: numeric("awarded_value", { precision: 18, scale: 2 }),
    status: text("status").default("unknown").notNull(),
    judgmentCriterion: text("judgment_criterion"),
    disputeMode: text("dispute_mode"),
    sourceUrl: text("source_url"),
    noticeUrl: text("notice_url"),
    documents: jsonb("documents").$type().notNull().default([]),
    itemCount: integer("item_count"),
    lastSourceUpdateAt: timestamp("last_source_update_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    rawData: jsonb("raw_data").$type().notNull().default({}),
    ...timestamps
  },
  (table) => [
    uniqueIndex("opportunities_source_key_unique").on(table.connectorId, table.sourceKey),
    uniqueIndex("opportunities_control_number_unique").on(table.controlNumber),
    index("opportunities_state_status_idx").on(table.state, table.status),
    index("opportunities_publication_idx").on(table.publicationDate),
    index("opportunities_deadline_idx").on(table.proposalDeadline),
    index("opportunities_agency_idx").on(table.agencyName),
    index("opportunities_modality_idx").on(table.modality)
  ]
);
var opportunityItems = pgTable(
  "opportunity_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    itemNumber: text("item_number"),
    description: text("description").notNull(),
    catalogCode: text("catalog_code"),
    catalogSystem: text("catalog_system"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }),
    unit: text("unit"),
    estimatedUnitValue: numeric("estimated_unit_value", { precision: 18, scale: 4 }),
    estimatedTotalValue: numeric("estimated_total_value", { precision: 18, scale: 2 }),
    specifications: text("specifications"),
    sourceItemKey: text("source_item_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("opportunity_items_opportunity_idx").on(table.opportunityId), index("opportunity_items_catalog_idx").on(table.catalogCode)]
);
var opportunityHistory = pgTable(
  "opportunity_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    summary: text("summary"),
    previousValues: jsonb("previous_values").$type(),
    newValues: jsonb("new_values").$type(),
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("opportunity_history_opportunity_idx").on(table.opportunityId, table.happenedAt)]
);
var favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("favorites_user_opportunity_unique").on(table.userId, table.opportunityId), index("favorites_user_idx").on(table.userId)]
);
var savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    criteria: jsonb("criteria").$type().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("saved_searches_user_idx").on(table.userId)]
);
var alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    criteria: jsonb("criteria").$type().notNull().default({}),
    channels: jsonb("channels").$type().notNull().default(["in_app"]),
    frequency: text("frequency").default("daily").notNull(),
    active: boolean("active").default(true).notNull(),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("alerts_user_active_idx").on(table.userId, table.active)]
);
var notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("notifications_user_created_idx").on(table.userId, table.createdAt)]
);
var followedOpportunities = pgTable(
  "followed_opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    pipelineStatus: pipelineStatusEnum("pipeline_status").default("new").notNull(),
    privateNotes: text("private_notes"),
    responsibleUserId: uuid("responsible_user_id").references(() => users.id, { onDelete: "set null" }),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("followed_user_opportunity_unique").on(table.userId, table.opportunityId), index("followed_opportunities_company_idx").on(table.companyId)]
);
var opportunityActivities = pgTable(
  "opportunity_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followedOpportunityId: uuid("followed_opportunity_id").notNull().references(() => followedOpportunities.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("opportunity_activities_followed_idx").on(table.followedOpportunityId, table.createdAt)]
);
var plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 80 }).notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    monthlyPriceCents: integer("monthly_price_cents").default(0).notNull(),
    annualPriceCents: integer("annual_price_cents").default(0).notNull(),
    limits: jsonb("limits").$type().notNull().default({}),
    features: jsonb("features").$type().notNull().default([]),
    active: boolean("active").default(true).notNull(),
    ...timestamps
  }
);
var subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
    status: text("status").default("trialing").notNull(),
    billingInterval: text("billing_interval").default("monthly").notNull(),
    provider: text("provider"),
    providerSubscriptionId: text("provider_subscription_id"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("subscriptions_company_status_idx").on(table.companyId, table.status)]
);
var payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
    status: text("status").default("pending").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rawStatus: text("raw_status"),
    ...timestamps
  },
  (table) => [index("payments_company_created_idx").on(table.companyId, table.createdAt), uniqueIndex("payments_provider_id_unique").on(table.provider, table.providerPaymentId)]
);
var auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt), index("audit_logs_entity_idx").on(table.entityType, table.entityId)]
);
var emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("email_verifications_token_hash_unique").on(table.tokenHash), index("email_verifications_user_idx").on(table.userId)]);
var passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash), index("password_reset_tokens_user_idx").on(table.userId)]);

// server/db.ts
import { createHash, X509Certificate } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
var pool = null;
var database = null;
function normalizeSupabaseCa(raw = process.env.ORBEEDITAL_POSTGRES_CA_URL ?? process.env.ORBEEDITAL_POSTGRES_CA_CERT ?? "") {
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
    return `-----BEGIN CERTIFICATE-----
${base64}
-----END CERTIFICATE-----`;
  });
  return `${normalized.join("\n")}
`;
}
function getConnectionString() {
  const raw = process.env.ORBEEDITAL_POSTGRES_URL;
  if (!raw) throw new Error("ORBEEDITAL_POSTGRES_URL is not configured");
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("ORBEEDITAL_POSTGRES_URL must be a PostgreSQL URI");
  }
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(key);
  return url.toString();
}
function getPool() {
  if (pool) return pool;
  const connectionString = getConnectionString();
  const ca = normalizeSupabaseCa();
  const config = {
    connectionString,
    ssl: { ca, rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 1e4,
    application_name: "orbeedital"
  };
  pool = new Pool(config);
  pool.on("error", (error) => {
    const code = error.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "UNCLASSIFIED";
    console.error("[PostgreSQL] idle pool error", code);
  });
  return pool;
}
function getDb() {
  if (!database) database = drizzle(getPool(), { schema: schema_exports });
  return database;
}
function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

// server/auth.ts
var AUTH_COOKIE_NAME = "orbeedital_session";
var CSRF_COOKIE_NAME = "orbeedital_csrf";
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 14;
var SCRYPT_N = 32768;
var SCRYPT_R = 8;
var SCRYPT_P = 1;
var SCRYPT_KEY_BYTES = 64;
var SCRYPT_MAXMEM = 64 * 1024 * 1024;
function derivePasswordKey(password, salt, length) {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      }
    );
  });
}
async function hashPassword(password) {
  if (password.length < 10 || password.length > 128) {
    throw new Error("A senha deve ter entre 10 e 128 caracteres.");
  }
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt, SCRYPT_KEY_BYTES);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
async function verifyPassword(password, encoded) {
  try {
    const [algorithm, nText, rText, pText, saltText, keyText] = encoded.split("$");
    if (algorithm !== "scrypt" || Number(nText) !== SCRYPT_N || Number(rText) !== SCRYPT_R || Number(pText) !== SCRYPT_P || !saltText || !keyText)
      return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (salt.length !== 16 || expected.length !== SCRYPT_KEY_BYTES)
      return false;
    const actual = await derivePasswordKey(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
async function createCompanyAccount(input) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const cnpj = input.cnpj?.replace(/\D/g, "") || null;
  const database2 = getDb();
  return database2.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email,
      passwordHash,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      role: "user"
    }).returning();
    const [company] = await tx.insert(companies).values({
      legalName: input.companyName.trim(),
      cnpj,
      state: input.state?.trim().toUpperCase() || null,
      municipality: input.municipality?.trim() || null,
      primarySegment: input.segment?.trim() || null
    }).returning({ id: companies.id });
    await tx.insert(companyMembers).values({ companyId: company.id, userId: user.id, memberRole: "owner" });
    await tx.insert(companyProfiles).values({
      companyId: company.id,
      segments: input.segment?.trim() ? [input.segment.trim()] : []
    });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  });
}
async function findUserForLogin(email) {
  try {
    const [user] = await getDb().select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
    return user;
  } catch (error) {
    const details = error;
    const cause = details.cause;
    console.error("[auth] PostgreSQL user lookup failed", {
      code: typeof details.code === "string" ? details.code : "UNCLASSIFIED",
      name: typeof details.name === "string" ? details.name : "Error",
      message: typeof details.message === "string" ? details.message : "Unknown database error",
      causeCode: typeof cause?.code === "string" ? cause.code : "UNCLASSIFIED",
      causeName: typeof cause?.name === "string" ? cause.name : "UnknownCause",
      causeMessage: typeof cause?.message === "string" ? cause.message : "Unknown database cause"
    });
    throw error;
  }
}
async function touchLastSignedIn(userId) {
  await getDb().update(users).set({ lastSignedIn: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb().insert(authSessions).values({ tokenHash: hashSessionToken(token), userId, expiresAt });
  return { token, expiresAt };
}
async function revokeSession(token) {
  if (!token) return;
  await getDb().delete(authSessions).where(eq(authSessions.tokenHash, hashSessionToken(token)));
}
function getSessionToken(req) {
  const request = req;
  const cookies = parseCookieHeader(request.headers.cookie ?? "");
  return cookies[AUTH_COOKIE_NAME];
}
async function getUserFromRequest(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const now = /* @__PURE__ */ new Date();
  const rows = await getDb().select({ user: users }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id)).where(
    and(
      eq(authSessions.tokenHash, hashSessionToken(token)),
      gt(authSessions.expiresAt, now)
    )
  ).limit(1);
  const user = rows[0]?.user;
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
function newCsrfToken() {
  return randomBytes(32).toString("hex");
}
function constantTimeStringEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// server/_core/cookies.ts
function getSessionCookieOptions(_req) {
  return { httpOnly: true, path: "/", sameSite: "none", secure: true };
}

// server/_core/publicConfig.ts
function publicPlatformConfig(env = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? ""
  };
}
function publicPlatformScript(env = process.env) {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}

// server/_core/context.ts
async function createContext(opts) {
  const user = await getUserFromRequest(opts.req);
  return { req: opts.req, res: opts.res, user };
}

// server/routers.ts
import { parse as parseCookieHeader2 } from "cookie";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { count as count2, desc as desc3, eq as eq5, inArray as inArray3, sum as sum2 } from "drizzle-orm";
import { z as z2 } from "zod";

// server/services/authActions.ts
import { createHash as createHash3, randomBytes as randomBytes2 } from "node:crypto";
import { and as and2, desc, eq as eq2, gt as gt2 } from "drizzle-orm";

// server/services/email.ts
import { createHash as createHash2 } from "node:crypto";
import nodemailer from "nodemailer";
var EmailDeliveryError = class extends Error {
  constructor(code) {
    super("Email delivery is unavailable.");
    this.code = code;
    this.name = "EmailDeliveryError";
  }
};
function selectedEmailProvider() {
  const configured = process.env.ORBEEDITAL_EMAIL_PROVIDER?.trim().toLowerCase() || "smtp";
  if (configured === "smtp") return "gmail_smtp";
  if (configured === "resend") return "resend";
  throw new EmailDeliveryError("configuration_invalid");
}
function getEmailProviderForAudit() {
  try {
    return selectedEmailProvider();
  } catch {
    return "unknown";
  }
}
function getPublicOrigin() {
  const publicBaseUrl = process.env.ORBEEDITAL_PUBLIC_BASE_URL?.trim();
  if (!publicBaseUrl) throw new EmailDeliveryError("configuration_missing");
  let origin;
  try {
    origin = new URL(publicBaseUrl);
  } catch {
    throw new EmailDeliveryError("configuration_invalid");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/" && origin.pathname !== "") {
    throw new EmailDeliveryError("configuration_invalid");
  }
  return origin.origin;
}
function getGmailSmtpConfiguration() {
  const user = process.env.ORBEEDITAL_SMTP_USER?.trim();
  const rawAppPassword = process.env.ORBEEDITAL_SMTP_APP_PASSWORD?.trim();
  if (!user || !rawAppPassword) throw new EmailDeliveryError("configuration_missing");
  const appPassword = rawAppPassword.replace(/\s/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) || !/^[A-Za-z0-9]{16}$/.test(appPassword)) {
    throw new EmailDeliveryError("configuration_invalid");
  }
  const from = process.env.ORBEEDITAL_EMAIL_FROM?.trim() || `OrbeEdital <${user}>`;
  if (/[\r\n]/.test(from)) throw new EmailDeliveryError("configuration_invalid");
  return { user, appPassword, from };
}
function getResendConfiguration() {
  const apiKey = process.env.ORBEEDITAL_RESEND_API_KEY?.trim();
  const from = process.env.ORBEEDITAL_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new EmailDeliveryError("configuration_missing");
  if (/[\r\n]/.test(from)) throw new EmailDeliveryError("configuration_invalid");
  return { apiKey, from };
}
function buildEmailActionUrl(path, token) {
  const url = new URL(path, getPublicOrigin());
  url.searchParams.set("token", token);
  return url.toString();
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character] ?? character;
  });
}
function template(title, name, link, actionLabel, expiry) {
  const safeName = escapeHtml(name || "");
  const safeLink = escapeHtml(link);
  return {
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f8fb;font-family:Arial,sans-serif;color:#1e293b"><main style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e2e8f0"><p style="font-size:13px;font-weight:bold;letter-spacing:.08em;color:#087eaa">ORBEEDITAL</p><h1 style="font-size:24px;color:#102b4e">${title}</h1><p>Ol\xE1${safeName ? `, ${safeName}` : ""}.</p><p>Para continuar, use o bot\xE3o abaixo. Este link expira em ${expiry} e s\xF3 pode ser usado uma vez.</p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#087eaa;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">${actionLabel}</a></p><p style="font-size:13px;color:#64748b">Se o bot\xE3o n\xE3o funcionar, copie este endere\xE7o para o navegador:<br><span>${safeLink}</span></p><p style="font-size:13px;color:#64748b">Se voc\xEA n\xE3o solicitou esta mensagem, ignore-a. Nunca compartilhe este link.</p></main></body></html>`,
    text: `${title}

Ol\xE1${name ? `, ${name}` : ""}.

Acesse este link para continuar: ${link}

O link expira em ${expiry} e s\xF3 pode ser usado uma vez. Se voc\xEA n\xE3o solicitou esta mensagem, ignore-a.`
  };
}
async function sendGmailSmtpEmail(message) {
  const { user, appPassword, from } = getGmailSmtpConfiguration();
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass: appPassword },
    connectionTimeout: 1e4,
    greetingTimeout: 1e4,
    socketTimeout: 15e3,
    tls: { minVersion: "TLSv1.2" }
  });
  try {
    const result = await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text
    });
    const acceptedRecipients = result.accepted.map((recipient) => recipient.toLowerCase());
    if (!acceptedRecipients.includes(message.to.toLowerCase())) {
      throw new EmailDeliveryError("provider_rejected");
    }
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    const smtpCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    throw new EmailDeliveryError(smtpCode === "EAUTH" ? "smtp_auth_failed" : "transport_failed");
  } finally {
    transporter.close();
  }
}
async function sendResendEmail(message) {
  const { apiKey, from } = getResendConfiguration();
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text
      }),
      signal: AbortSignal.timeout(1e4)
    });
  } catch {
    throw new EmailDeliveryError("transport_failed");
  }
  if (!response.ok) {
    console.error("[email] Resend rejected a transactional email", response.status);
    throw new EmailDeliveryError("provider_rejected");
  }
}
async function sendTransactionalEmail(message) {
  const provider = selectedEmailProvider();
  getPublicOrigin();
  if (provider === "gmail_smtp") return sendGmailSmtpEmail(message);
  return sendResendEmail(message);
}
async function sendVerificationEmail(input) {
  const link = buildEmailActionUrl("/verify-email", input.token);
  const content = template("Confirme seu e-mail", input.name, link, "Confirmar e-mail", "24 horas");
  await sendTransactionalEmail({
    to: input.to,
    subject: "Confirme seu e-mail do OrbeEdital",
    ...content,
    idempotencyKey: `email-verify-${createHash2("sha256").update(input.tokenHash).digest("hex")}`
  });
}
async function sendPasswordResetEmail(input) {
  const link = buildEmailActionUrl("/reset-password", input.token);
  const content = template("Redefina sua senha", input.name, link, "Criar nova senha", "30 minutos");
  await sendTransactionalEmail({
    to: input.to,
    subject: "Redefina sua senha do OrbeEdital",
    ...content,
    idempotencyKey: `password-reset-${createHash2("sha256").update(input.tokenHash).digest("hex")}`
  });
}

// server/services/emailAudit.ts
function safeDatabaseCode(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) return "unknown";
  const code = String(error.code);
  return /^[A-Z0-9_]{1,32}$/.test(code) ? code : "unknown";
}
async function recordTransactionalEmailEvent(input) {
  try {
    await getDb().insert(auditLogs).values({
      actorUserId: input.userId,
      action: `email.${input.outcome}`,
      entityType: "transactional_email",
      entityId: input.kind,
      details: {
        provider: getEmailProviderForAudit(),
        outcome: input.outcome,
        ...input.errorCode ? { errorCode: input.errorCode } : {}
      }
    });
    return true;
  } catch (error) {
    console.error("[email] could not persist delivery audit event", safeDatabaseCode(error));
    return false;
  }
}

// server/services/authActions.ts
var EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1e3;
var PASSWORD_RESET_TTL_MS = 30 * 60 * 1e3;
var RESEND_COOLDOWN_MS = 60 * 1e3;
function hashActionToken(token) {
  return createHash3("sha256").update(token).digest("hex");
}
function newActionToken() {
  const token = randomBytes2(32).toString("base64url");
  return { token, tokenHash: hashActionToken(token) };
}
function deliveryFailureCode(error) {
  return error instanceof EmailDeliveryError ? error.code : "unexpected";
}
function logDeliveryFailure(kind, error) {
  const code = deliveryFailureCode(error);
  console.error(`[email] ${kind} message not delivered`, code);
}
async function recordEmailEvent(input) {
  const recorded = await recordTransactionalEmailEvent(input);
  if (!recorded) console.error(`[email] ${input.kind} ${input.outcome} audit event is not persistent`, "audit_unavailable");
  return recorded;
}
async function issueEmailVerification(user) {
  if (user.emailVerifiedAt) return false;
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const [recent] = await db.select({ createdAt: emailVerifications.createdAt }).from(emailVerifications).where(eq2(emailVerifications.userId, user.id)).orderBy(desc(emailVerifications.createdAt)).limit(1);
  if (recent && now.getTime() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) return false;
  const action = newActionToken();
  await db.transaction(async (tx) => {
    await tx.delete(emailVerifications).where(eq2(emailVerifications.userId, user.id));
    await tx.insert(emailVerifications).values({
      userId: user.id,
      tokenHash: action.tokenHash,
      expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS)
    });
  });
  if (!await recordEmailEvent({ userId: user.id, kind: "verification", outcome: "attempted" })) {
    console.error("[email] verification message not sent because attempt audit is unavailable", "audit_unavailable");
    return false;
  }
  try {
    await sendVerificationEmail({ ...action, to: user.email, name: user.name });
    await recordEmailEvent({ userId: user.id, kind: "verification", outcome: "accepted" });
    return true;
  } catch (error) {
    logDeliveryFailure("verification", error);
    await recordEmailEvent({
      userId: user.id,
      kind: "verification",
      outcome: "failed",
      errorCode: deliveryFailureCode(error)
    });
    return false;
  }
}
async function verifyEmailAction(token) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return false;
  const now = /* @__PURE__ */ new Date();
  return getDb().transaction(async (tx) => {
    const [action] = await tx.delete(emailVerifications).where(and2(eq2(emailVerifications.tokenHash, hashActionToken(token)), gt2(emailVerifications.expiresAt, now))).returning({ userId: emailVerifications.userId });
    if (!action) return false;
    await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq2(users.id, action.userId));
    await tx.delete(emailVerifications).where(eq2(emailVerifications.userId, action.userId));
    return true;
  });
}
async function issuePasswordReset(user) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const [recent] = await db.select({ createdAt: passwordResetTokens.createdAt }).from(passwordResetTokens).where(eq2(passwordResetTokens.userId, user.id)).orderBy(desc(passwordResetTokens.createdAt)).limit(1);
  if (recent && now.getTime() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) return false;
  const action = newActionToken();
  await db.transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq2(passwordResetTokens.userId, user.id));
    await tx.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: action.tokenHash,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS)
    });
  });
  if (!await recordEmailEvent({ userId: user.id, kind: "password_reset", outcome: "attempted" })) {
    console.error("[email] password_reset message not sent because attempt audit is unavailable", "audit_unavailable");
    return false;
  }
  try {
    await sendPasswordResetEmail({ ...action, to: user.email, name: user.name });
    await recordEmailEvent({ userId: user.id, kind: "password_reset", outcome: "accepted" });
    return true;
  } catch (error) {
    logDeliveryFailure("password_reset", error);
    await recordEmailEvent({
      userId: user.id,
      kind: "password_reset",
      outcome: "failed",
      errorCode: deliveryFailureCode(error)
    });
    return false;
  }
}
async function resetPasswordAction(token, password) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return false;
  const passwordHash = await hashPassword(password);
  const now = /* @__PURE__ */ new Date();
  return getDb().transaction(async (tx) => {
    const [action] = await tx.delete(passwordResetTokens).where(and2(eq2(passwordResetTokens.tokenHash, hashActionToken(token)), gt2(passwordResetTokens.expiresAt, now))).returning({ userId: passwordResetTokens.userId });
    if (!action) return false;
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq2(users.id, action.userId));
    await tx.delete(passwordResetTokens).where(eq2(passwordResetTokens.userId, action.userId));
    await tx.delete(authSessions).where(eq2(authSessions.userId, action.userId));
    return true;
  });
}
async function findAccountByEmail(email) {
  const [user] = await getDb().select().from(users).where(eq2(users.email, email)).limit(1);
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var ENV = {
  get appId() {
    return process.env.MANUS_PROJECT_ID ?? "";
  },
  get cookieSecret() {
    return process.env.MANUS_JWT_SECRET ?? "";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get oAuthServerUrl() {
    return process.env.MANUS_OAUTH_API_URL ?? "";
  },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.MANUS_API_URL ?? "";
  },
  get forgeApiKey() {
    return process.env.MANUS_API_KEY ?? "";
  }
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// shared/const.ts
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({ transformer: superjson });
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var requireVerifiedEmail = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user?.emailVerifiedAt) {
    throw new TRPCError2({ code: "FORBIDDEN", message: "Confirme seu e-mail para acessar os recursos do OrbeEdital." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var protectedProcedure = t.procedure.use(requireUser).use(requireVerifiedEmail);
function requireRoles(roles) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (!ctx.user.emailVerifiedAt) {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Confirme seu e-mail para acessar os recursos do OrbeEdital." });
    }
    if (!roles.includes(ctx.user.role)) throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}
var adminProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "source_operator", "support", "finance"]));
var sourceOperatorProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "source_operator"]));
var financeProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "finance"]));
var superadminProcedure = t.procedure.use(requireRoles(["superadmin"]));

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/services/ingestion.ts
import { isDeepStrictEqual } from "node:util";
import { and as and4, eq as eq4, inArray as inArray2, or as or2, sql } from "drizzle-orm";

// server/connectors/types.ts
var ConnectorError = class extends Error {
  constructor(message, code, source, status, options) {
    super(message, options);
    this.code = code;
    this.source = source;
    this.status = status;
  }
  name = "ConnectorError";
};
var DEFAULT_MAX_PAGES = 3;
var DEFAULT_TIMEOUT_MS = 15e3;
var MAX_PAGE_LIMIT = 1e3;
function retryDelayMs(response, retryIndex) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const parsed = Number.isFinite(seconds) ? seconds * 1e3 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed, 3e4);
  }
  return Math.min(500 * 2 ** retryIndex, 3e4);
}
function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function fetchOfficialPage(url, timeoutMs, source) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    } catch (cause) {
      if (attempt < 2) {
        await wait(retryDelayMs(void 0, attempt));
        continue;
      }
      const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
      const label = source === "pncp" ? "PNCP" : "Compras.gov.br";
      throw new ConnectorError(timedOut ? `${label} request timed out` : `${label} network request failed`, timedOut ? "timeout" : "network", source, void 0, { cause });
    }
    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt < 2) {
      await wait(retryDelayMs(response, attempt));
      continue;
    }
    return response;
  }
  throw new ConnectorError("Official API request exhausted retry attempts", "network", source);
}
async function fetchOfficialJsonPage(url, timeoutMs, source, expectedArrayField) {
  const label = source === "pncp" ? "PNCP" : "Compras.gov.br";
  for (let attempt = 0; attempt <= 2; attempt++) {
    const response = await fetchOfficialPage(url, timeoutMs, source);
    if (response.status === 204) return { response, body: {} };
    if (!response.ok) {
      throw new ConnectorError(`${label} returned HTTP ${response.status}`, "http", source, response.status);
    }
    try {
      const parsed = optionalObject(await response.json());
      if (parsed && Array.isArray(parsed[expectedArrayField])) return { response, body: parsed };
    } catch (cause) {
      if (attempt >= 2) {
        throw new ConnectorError(`${label} returned invalid JSON`, "invalid_response", source, response.status, { cause });
      }
    }
    if (attempt < 2) {
      await wait(retryDelayMs(response, attempt));
      continue;
    }
    throw new ConnectorError(`${label} response is missing the expected ${expectedArrayField} array`, "invalid_response", source, response.status);
  }
  throw new ConnectorError("Official API response remained invalid after retries", "invalid_response", source);
}
function boundedInteger(value, fallback, min, max, field, source) {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < min || candidate > max) {
    throw new ConnectorError(`${field} must be an integer between ${min} and ${max}`, "invalid_input", source);
  }
  return candidate;
}
function assertAllPagesFetched(pages, allPages, maxPages, source) {
  if (!allPages) return;
  const lastPage = pages.at(-1);
  if (!lastPage) return;
  const reportedTotal = [...pages].reverse().find((page) => page.metadata.totalPages !== null)?.metadata.totalPages ?? null;
  const reportedRecords = [...pages].reverse().find((page) => page.metadata.totalRecords !== null)?.metadata.totalRecords ?? null;
  if (reportedTotal === null) {
    if (pages.length >= maxPages && lastPage.metadata.returned > 0) {
      throw new ConnectorError(
        `Official API pagination exceeded the safety ceiling of ${maxPages} pages; this run is incomplete.`,
        "pagination_limit",
        source
      );
    }
    throw new ConnectorError(
      "Official API did not provide totalPages, so full coverage cannot be confirmed.",
      "pagination_incomplete",
      source
    );
  }
  const stoppedEarly = reportedTotal !== null && (lastPage.metadata.page < reportedTotal || lastPage.metadata.returned === 0 && lastPage.metadata.page <= reportedTotal && reportedRecords !== 0);
  if (stoppedEarly) {
    if (pages.length >= maxPages && lastPage.metadata.returned > 0) {
      throw new ConnectorError(
        `Official API pagination exceeded the safety ceiling of ${maxPages} pages; this run is incomplete.`,
        "pagination_limit",
        source
      );
    }
    throw new ConnectorError(
      `Official API stopped at page ${lastPage.metadata.page} while reporting ${reportedTotal} pages.`,
      "pagination_incomplete",
      source
    );
  }
  const unknownEndAtSafetyCeiling = reportedTotal === null && pages.length >= maxPages && lastPage.metadata.returned > 0;
  if (unknownEndAtSafetyCeiling) {
    throw new ConnectorError(
      `Official API pagination exceeded the safety ceiling of ${maxPages} pages; this run is incomplete.`,
      "pagination_limit",
      source
    );
  }
}
function optionalString(value) {
  return typeof value === "string" ? value : null;
}
function optionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function optionalObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function optionalArray(value) {
  return Array.isArray(value) ? value : [];
}

// server/connectors/compras.ts
var SOURCE = "compras.gov.br";
var API_BASE = "https://dadosabertos.compras.gov.br";
function validateDate(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ConnectorError(`${name} must use YYYY-MM-DD`, "invalid_input", SOURCE);
  }
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ConnectorError(`${name} is not a valid calendar date`, "invalid_input", SOURCE);
  }
}
function toRecord(value, requestUrl) {
  const r = optionalObject(value) ?? {};
  const cnpj = optionalString(r.orgaoEntidadeCnpj);
  const year = optionalNumber(r.anoCompraPncp);
  const sequence = optionalNumber(r.sequencialCompraPncp);
  const id = optionalString(r.idCompra);
  return {
    source: SOURCE,
    externalId: id ?? (cnpj !== null && year !== null && sequence !== null ? `${cnpj}/${year}/${sequence}` : null),
    controlNumber: optionalString(r.numeroControlePNCP),
    title: optionalString(r.objetoCompra),
    description: optionalString(r.informacaoComplementar),
    organizationName: optionalString(r.orgaoEntidadeRazaoSocial),
    organizationCnpj: cnpj,
    unitName: optionalString(r.unidadeOrgaoNomeUnidade),
    modalityCode: optionalNumber(r.modalidadeIdPncp) ?? optionalNumber(r.codigoModalidade),
    modalityName: optionalString(r.modalidadeNome),
    publishedAt: optionalString(r.dataPublicacaoPncp),
    updatedAt: optionalString(r.dataAtualizacaoPncp),
    proposalOpensAt: optionalString(r.dataAberturaPropostaPncp),
    proposalClosesAt: optionalString(r.dataEncerramentoPropostaPncp),
    estimatedValue: optionalNumber(r.valorTotalEstimado),
    awardedValue: optionalNumber(r.valorTotalHomologado),
    sourceUrl: requestUrl,
    raw: r
  };
}
async function searchCompras(options) {
  validateDate(options.dataPublicacaoPncpInicial, "dataPublicacaoPncpInicial");
  validateDate(options.dataPublicacaoPncpFinal, "dataPublicacaoPncpFinal");
  if (options.dataAualizacaoPncp !== void 0) validateDate(options.dataAualizacaoPncp, "dataAualizacaoPncp");
  if (!Number.isInteger(options.codigoModalidade)) {
    throw new ConnectorError("codigoModalidade must be an integer", "invalid_input", SOURCE);
  }
  const page = boundedInteger(options.page, 1, 1, Number.MAX_SAFE_INTEGER, "page", SOURCE);
  const allPages = options.allPages === true;
  if (allPages && page !== 1) {
    throw new ConnectorError("allPages must start at page 1 to guarantee full coverage", "invalid_input", SOURCE);
  }
  const maxPages = allPages ? MAX_PAGE_LIMIT : boundedInteger(options.maxPages, DEFAULT_MAX_PAGES, 1, MAX_PAGE_LIMIT, "maxPages", SOURCE);
  const pageSize = boundedInteger(options.tamanhoPagina, 10, 10, 500, "tamanhoPagina", SOURCE);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1, 12e4, "timeoutMs", SOURCE);
  const filters = {
    unidadeOrgaoCodigoUnidade: options.unidadeOrgaoCodigoUnidade,
    codigoOrgao: options.codigoOrgao,
    orgaoEntidadeCnpj: options.orgaoEntidadeCnpj,
    dataPublicacaoPncpInicial: options.dataPublicacaoPncpInicial,
    dataPublicacaoPncpFinal: options.dataPublicacaoPncpFinal,
    codigoModalidade: options.codigoModalidade,
    unidadeOrgaoCodigoIbge: options.unidadeOrgaoCodigoIbge,
    unidadeOrgaoUfSigla: options.unidadeOrgaoUfSigla,
    dataAualizacaoPncp: options.dataAualizacaoPncp,
    amparoLegalCodigoPncp: options.amparoLegalCodigoPncp,
    contratacaoExcluida: options.contratacaoExcluida
  };
  const pages = [];
  for (let index2 = 0; index2 < maxPages; index2++) {
    const currentPage = page + index2;
    const url = new URL(`${API_BASE}/modulo-contratacoes/1_consultarContratacoes_PNCP_14133`);
    for (const [key, value] of Object.entries({ ...filters, pagina: currentPage, tamanhoPagina: pageSize })) {
      if (value !== void 0) url.searchParams.set(key, String(value));
    }
    const { response, body } = await fetchOfficialJsonPage(url, timeoutMs, SOURCE, "resultado");
    const results = optionalArray(body.resultado);
    const totalPages = optionalNumber(body.totalPaginas);
    pages.push({
      source: SOURCE,
      items: results.map((row) => toRecord(row, url.toString())),
      metadata: {
        page: currentPage,
        totalPages,
        totalRecords: optionalNumber(body.totalRegistros),
        pagesRemaining: optionalNumber(body.paginasRestantes),
        returned: results.length
      },
      requestUrl: url.toString()
    });
    if (response.status === 204 || results.length === 0 || totalPages !== null && currentPage >= totalPages) break;
  }
  assertAllPagesFetched(pages, allPages, maxPages, SOURCE);
  return pages;
}

// server/connectors/pncp.ts
var SOURCE2 = "pncp";
var API_BASE2 = "https://pncp.gov.br/api/consulta";
function validateDate2(value, name) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!match || !date || date.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) {
    throw new ConnectorError(`${name} must use yyyyMMdd`, "invalid_input", SOURCE2);
  }
}
function toRecord2(value, requestUrl) {
  const r = optionalObject(value) ?? {};
  const org = optionalObject(r.orgaoEntidade);
  const unit = optionalObject(r.unidadeOrgao);
  const idBits = [optionalString(org?.cnpj), optionalNumber(r.anoCompra), optionalNumber(r.sequencialCompra)];
  const sourceUrl = optionalString(r.linkSistemaOrigem) ?? requestUrl;
  return {
    source: SOURCE2,
    externalId: idBits.every((x) => x !== null) ? idBits.join("/") : optionalString(r.numeroControlePNCP),
    controlNumber: optionalString(r.numeroControlePNCP),
    title: optionalString(r.objetoCompra),
    description: optionalString(r.informacaoComplementar),
    organizationName: optionalString(org?.razaoSocial),
    organizationCnpj: optionalString(org?.cnpj),
    unitName: optionalString(unit?.nomeUnidade),
    modalityCode: optionalNumber(r.modalidadeId),
    modalityName: optionalString(r.modalidadeNome),
    publishedAt: optionalString(r.dataPublicacaoPncp),
    updatedAt: optionalString(r.dataAtualizacaoGlobal) ?? optionalString(r.dataAtualizacao),
    proposalOpensAt: optionalString(r.dataAberturaProposta),
    proposalClosesAt: optionalString(r.dataEncerramentoProposta),
    estimatedValue: optionalNumber(r.valorTotalEstimado),
    awardedValue: optionalNumber(r.valorTotalHomologado),
    sourceUrl,
    raw: r
  };
}
async function fetchPages(endpoint, baseParams, options) {
  const page = boundedInteger(options.page, 1, 1, Number.MAX_SAFE_INTEGER, "page", SOURCE2);
  const allPages = options.allPages === true;
  if (allPages && page !== 1) {
    throw new ConnectorError("allPages must start at page 1 to guarantee full coverage", "invalid_input", SOURCE2);
  }
  const maxPages = allPages ? MAX_PAGE_LIMIT : boundedInteger(options.maxPages, DEFAULT_MAX_PAGES, 1, MAX_PAGE_LIMIT, "maxPages", SOURCE2);
  const pageSize = boundedInteger(options.pageSize, 10, 10, 50, "tamanhoPagina", SOURCE2);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1, 12e4, "timeoutMs", SOURCE2);
  const pages = [];
  for (let index2 = 0; index2 < maxPages; index2++) {
    const currentPage = page + index2;
    const url = new URL(`${API_BASE2}/v1/contratacoes/${endpoint}`);
    for (const [key, value] of Object.entries({ ...baseParams, pagina: currentPage, tamanhoPagina: pageSize })) {
      if (value !== void 0) url.searchParams.set(key, String(value));
    }
    const { response, body } = await fetchOfficialJsonPage(url, timeoutMs, SOURCE2, "data");
    const data = optionalArray(body.data);
    const totalPages = optionalNumber(body.totalPaginas);
    pages.push({
      source: SOURCE2,
      items: data.map((row) => toRecord2(row, url.toString())),
      metadata: {
        page: currentPage,
        totalPages,
        totalRecords: optionalNumber(body.totalRegistros),
        pagesRemaining: optionalNumber(body.paginasRestantes),
        returned: data.length
      },
      requestUrl: url.toString()
    });
    if (response.status === 204 || data.length === 0 || totalPages !== null && currentPage >= totalPages) break;
  }
  assertAllPagesFetched(pages, allPages, maxPages, SOURCE2);
  return pages;
}
async function searchPncp(options) {
  validateDate2(options.dataInicial, "dataInicial");
  validateDate2(options.dataFinal, "dataFinal");
  if (!Number.isInteger(options.codigoModalidadeContratacao)) {
    throw new ConnectorError("codigoModalidadeContratacao must be an integer", "invalid_input", SOURCE2);
  }
  const params = {
    dataInicial: options.dataInicial,
    dataFinal: options.dataFinal,
    codigoModalidadeContratacao: options.codigoModalidadeContratacao,
    codigoModoDisputa: options.codigoModoDisputa,
    uf: options.uf,
    codigoMunicipioIbge: options.codigoMunicipioIbge,
    cnpj: options.cnpj,
    codigoUnidadeAdministrativa: options.codigoUnidadeAdministrativa,
    idUsuario: options.idUsuario
  };
  return fetchPages("publicacao", params, { ...options, pageSize: options.tamanhoPagina });
}
async function searchPncpOpen(options) {
  validateDate2(options.dataFinal, "dataFinal");
  if (options.codigoModalidadeContratacao !== void 0 && !Number.isInteger(options.codigoModalidadeContratacao)) {
    throw new ConnectorError("codigoModalidadeContratacao must be an integer", "invalid_input", SOURCE2);
  }
  const params = {
    dataFinal: options.dataFinal,
    codigoModalidadeContratacao: options.codigoModalidadeContratacao,
    uf: options.uf,
    codigoMunicipioIbge: options.codigoMunicipioIbge,
    cnpj: options.cnpj,
    codigoUnidadeAdministrativa: options.codigoUnidadeAdministrativa,
    idUsuario: options.idUsuario
  };
  return fetchPages("proposta", params, { ...options, pageSize: options.tamanhoPagina });
}

// server/services/opportunities.ts
import { and as and3, asc, count, desc as desc2, eq as eq3, gte, ilike, inArray, isNull, lt, lte, or, sum } from "drizzle-orm";

// server/connectors/presentation.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function textValue(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function integerValue(value) {
  const text2 = textValue(value);
  if (!text2 || !/^\d+$/.test(text2)) return null;
  const parsed = Number(text2);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
function buildPncpDetailUrl(input) {
  const raw = input.raw;
  const organization = asRecord(raw.orgaoEntidade);
  const cnpjCandidates = [
    input.agencyCnpj,
    raw.orgaoEntidadeCnpj,
    raw.orgaoEntidadeCnpjPncp,
    organization.cnpj
  ];
  const cnpj = cnpjCandidates.map(textValue).filter((value) => value !== null).map((value) => value.replace(/\D/g, "")).find((value) => /^\d{14}$/.test(value));
  const year = integerValue(raw.anoCompra) ?? integerValue(raw.anoCompraPncp);
  const sequence = integerValue(raw.sequencialCompra) ?? integerValue(raw.sequencialCompraPncp);
  if (!cnpj || !year || year < 2e3 || year > 2100 || !sequence || sequence < 1) return null;
  return `https://pncp.gov.br/app/editais/${cnpj}/${year}/${sequence}`;
}
function normalizeProcurementStatus(rawValue, fallback = "unknown") {
  const raw = asRecord(rawValue);
  const text2 = [
    raw.situacaoCompraNomePncp,
    raw.situacaoCompraNome,
    raw.situacaoNome,
    raw.status
  ].map(textValue).find((value) => value !== null);
  if (!text2) return fallback;
  const normalized = text2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("suspens")) return "suspended";
  if (normalized.includes("revog")) return "revoked";
  if (normalized.includes("anulad")) return "annulled";
  if (normalized.includes("homolog")) return "homologated";
  if (normalized.includes("adjudic")) return "awarded";
  if (normalized.includes("julg")) return "judging";
  if (normalized.includes("receb") || normalized.includes("proposta")) return "receiving_proposals";
  if (normalized.includes("abert") || normalized.includes("andamento")) return "open";
  if (normalized.includes("encerr") || normalized.includes("finaliz")) return "closed";
  if (normalized.includes("divulg") || normalized.includes("publicad")) return "published";
  return "unknown";
}

// server/services/opportunities.ts
var OPPORTUNITIES_PAGE_SIZE = 25;
var OPEN_STATUSES = ["unknown", "published", "receiving_proposals", "open", "in_progress"];
function brazilDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}
function brazilDayBounds(value) {
  const { year, month, day } = brazilDateParts(value);
  const start = /* @__PURE__ */ new Date(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}T00:00:00-03:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1e3) };
}
var publicConnectorSeeds = [
  { code: "pncp", name: "PNCP \u2014 API de Consulta", baseUrl: "https://pncp.gov.br/api/consulta", integrationType: "official_api" },
  { code: "compras.gov.br", name: "Compras.gov.br \u2014 Dados Abertos", baseUrl: "https://dadosabertos.compras.gov.br", integrationType: "official_api" }
];
function rawRecord(opportunity) {
  const raw = opportunity.rawData?.raw;
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function presentOpportunity(opportunity) {
  const raw = rawRecord(opportunity);
  const { rawData: _rawData, ...publicOpportunity } = opportunity;
  return {
    ...publicOpportunity,
    sourceUrl: buildPncpDetailUrl({ agencyCnpj: opportunity.agencyCnpj, raw }),
    status: normalizeProcurementStatus(raw, opportunity.status)
  };
}
async function ensureBuiltInConnectors() {
  const db = getDb();
  for (const source of publicConnectorSeeds) {
    await db.insert(connectors).values(source).onConflictDoUpdate({
      target: connectors.code,
      set: { name: source.name, baseUrl: source.baseUrl, integrationType: source.integrationType, updatedAt: /* @__PURE__ */ new Date() }
    });
  }
}
function buildFilters(filters) {
  const clauses = [];
  const query = filters.query?.trim();
  if (query) {
    const like = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const matches = [
      ilike(opportunities.title, like),
      ilike(opportunities.description, like),
      ilike(opportunities.agencyName, like),
      ilike(opportunities.processNumber, like),
      ilike(opportunities.procurementNumber, like),
      ilike(opportunities.agencyCnpj, like)
    ];
    clauses.push(or(...matches));
  }
  if (filters.states?.length) clauses.push(inArray(opportunities.state, filters.states.map((state) => state.toUpperCase())));
  if (filters.municipality?.trim()) clauses.push(ilike(opportunities.municipality, `%${filters.municipality.trim()}%`));
  if (filters.modalities?.length) clauses.push(inArray(opportunities.modality, filters.modalities));
  if (filters.statuses?.length) clauses.push(inArray(opportunities.status, filters.statuses));
  if (filters.minValue !== void 0) clauses.push(gte(opportunities.estimatedValue, String(filters.minValue)));
  if (filters.maxValue !== void 0) clauses.push(lte(opportunities.estimatedValue, String(filters.maxValue)));
  if (filters.publishedFrom) clauses.push(gte(opportunities.publicationDate, new Date(filters.publishedFrom)));
  if (filters.publishedTo) clauses.push(lte(opportunities.publicationDate, new Date(filters.publishedTo)));
  if (filters.deadlineFrom) clauses.push(gte(opportunities.proposalDeadline, new Date(filters.deadlineFrom)));
  if (filters.deadlineTo) clauses.push(lte(opportunities.proposalDeadline, new Date(filters.deadlineTo)));
  if (filters.source) clauses.push(eq3(connectors.code, filters.source));
  if (filters.onlyOpen) {
    clauses.push(gte(opportunities.proposalDeadline, /* @__PURE__ */ new Date()));
    clauses.push(inArray(opportunities.status, ["unknown", "published", "receiving_proposals", "open", "in_progress"]));
  }
  return clauses.length ? and3(...clauses) : void 0;
}
async function searchOpportunities(filters, userId) {
  const db = getDb();
  const where = buildFilters(filters);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = OPPORTUNITIES_PAGE_SIZE;
  const [totalRow] = await db.select({ total: count() }).from(opportunities).innerJoin(connectors, eq3(opportunities.connectorId, connectors.id)).where(where);
  const rows = await db.select({ opportunity: opportunities, sourceName: connectors.name, sourceCode: connectors.code }).from(opportunities).innerJoin(connectors, eq3(opportunities.connectorId, connectors.id)).where(where).orderBy(asc(opportunities.proposalDeadline), desc2(opportunities.publicationDate), asc(opportunities.id)).limit(pageSize).offset((page - 1) * pageSize);
  const ids = rows.map((row) => row.opportunity.id);
  const saved = ids.length ? await db.select({ id: favorites.opportunityId }).from(favorites).where(and3(eq3(favorites.userId, userId), inArray(favorites.opportunityId, ids))) : [];
  const favoriteIds = new Set(saved.map((row) => row.id));
  return {
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total ?? 0) / pageSize)),
    items: rows.map((row) => {
      return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, sourceCode: row.sourceCode, isFavorite: favoriteIds.has(row.opportunity.id) };
    })
  };
}
async function getOpportunityDetail(id, userId) {
  const db = getDb();
  const rows = await db.select({ opportunity: opportunities, sourceName: connectors.name, sourceCode: connectors.code }).from(opportunities).innerJoin(connectors, eq3(opportunities.connectorId, connectors.id)).where(eq3(opportunities.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const [items, history, saved] = await Promise.all([
    db.select().from(opportunityItems).where(eq3(opportunityItems.opportunityId, id)),
    db.select().from(opportunityHistory).where(eq3(opportunityHistory.opportunityId, id)).orderBy(desc2(opportunityHistory.happenedAt)).limit(30),
    db.select({ id: favorites.id }).from(favorites).where(and3(eq3(favorites.userId, userId), eq3(favorites.opportunityId, id))).limit(1)
  ]);
  return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, sourceCode: row.sourceCode, isFavorite: saved.length > 0, items, history };
}
async function listFavorites(userId) {
  const rows = await getDb().select({ opportunity: opportunities, sourceName: connectors.name }).from(favorites).innerJoin(opportunities, eq3(favorites.opportunityId, opportunities.id)).innerJoin(connectors, eq3(opportunities.connectorId, connectors.id)).where(eq3(favorites.userId, userId)).orderBy(desc2(favorites.createdAt));
  return rows.map((row) => {
    return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, isFavorite: true };
  });
}
async function toggleFavorite(userId, opportunityId) {
  const db = getDb();
  const existing = await db.select({ id: favorites.id }).from(favorites).where(and3(eq3(favorites.userId, userId), eq3(favorites.opportunityId, opportunityId))).limit(1);
  if (existing.length) {
    await db.delete(favorites).where(eq3(favorites.id, existing[0].id));
    return false;
  }
  await db.insert(favorites).values({ userId, opportunityId }).onConflictDoNothing();
  return true;
}
async function getDashboardSummary(user) {
  await ensureBuiltInConnectors();
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const today = brazilDayBounds(now);
  const nextWeek = new Date(today.end.getTime() + 7 * 24 * 60 * 60 * 1e3);
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const [all, open, closingToday, closingSoon, fresh, withoutDeadline, value, savedCount, byState, byModality, sourceRows, lastRuns] = await Promise.all([
    db.select({ n: count() }).from(opportunities),
    db.select({ n: count() }).from(opportunities).where(and3(gte(opportunities.proposalDeadline, now), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and3(gte(opportunities.proposalDeadline, today.start), lt(opportunities.proposalDeadline, today.end), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and3(gte(opportunities.proposalDeadline, now), lt(opportunities.proposalDeadline, nextWeek), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(gte(opportunities.createdAt, day)),
    db.select({ n: count() }).from(opportunities).where(isNull(opportunities.proposalDeadline)),
    db.select({ n: sum(opportunities.estimatedValue) }).from(opportunities),
    db.select({ n: count() }).from(favorites).where(eq3(favorites.userId, user.id)),
    db.select({ label: opportunities.state, n: count() }).from(opportunities).where(inArray(opportunities.status, OPEN_STATUSES)).groupBy(opportunities.state).orderBy(desc2(count())).limit(8),
    db.select({ label: opportunities.modality, n: count() }).from(opportunities).groupBy(opportunities.modality).orderBy(desc2(count())).limit(8),
    db.select().from(connectors).orderBy(asc(connectors.name)),
    db.select({ run: syncRuns, sourceCode: connectors.code }).from(syncRuns).innerJoin(connectors, eq3(syncRuns.connectorId, connectors.id)).orderBy(desc2(syncRuns.startedAt)).limit(100)
  ]);
  const recentRows = await db.select({ opportunity: opportunities, sourceName: connectors.name }).from(opportunities).innerJoin(connectors, eq3(opportunities.connectorId, connectors.id)).orderBy(desc2(opportunities.publicationDate)).limit(6);
  const recent = recentRows.map((row) => {
    return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName };
  });
  return {
    total: all[0]?.n ?? 0,
    open: open[0]?.n ?? 0,
    closingToday: closingToday[0]?.n ?? 0,
    closingSoon: closingSoon[0]?.n ?? 0,
    new24h: fresh[0]?.n ?? 0,
    withoutDeadline: withoutDeadline[0]?.n ?? 0,
    estimatedValue: value[0]?.n ?? "0",
    favorites: savedCount[0]?.n ?? 0,
    byState: byState.filter((row) => row.label).map((row) => ({ label: row.label, value: row.n })),
    byModality: byModality.filter((row) => row.label).map((row) => ({ label: row.label, value: row.n })),
    sources: sourceRows.filter((source) => source.enabled || lastRuns.some((row) => row.sourceCode === source.code)).map((source) => {
      const runs = lastRuns.filter((row) => row.sourceCode === source.code);
      const lastSuccessful = runs.find((row) => ["completed", "succeeded", "success"].includes(row.run.status));
      const lastFailed = runs.find((row) => ["failed", "error"].includes(row.run.status));
      const status = !source.enabled ? "disabled" : lastFailed && (!lastSuccessful || new Date(lastFailed.run.startedAt) > new Date(lastSuccessful.run.startedAt)) ? "error" : lastSuccessful ? "active" : "pending";
      return { code: source.code, name: source.name, status, lastRunAt: lastSuccessful?.run.finishedAt ?? null, importedCount: source.importedCount, errorCount: lastFailed?.run.errorCount ?? source.errorCount };
    }),
    recent
  };
}
async function getCompanyIdForUser(userId) {
  const [row] = await getDb().select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq3(companyMembers.userId, userId)).limit(1);
  return row?.companyId ?? null;
}
async function listSavedSearches(userId) {
  return getDb().select().from(savedSearches).where(eq3(savedSearches.userId, userId)).orderBy(desc2(savedSearches.updatedAt));
}
async function saveSearch(userId, name, criteria) {
  const companyId = await getCompanyIdForUser(userId);
  const [row] = await getDb().insert(savedSearches).values({ userId, companyId, name, criteria, updatedAt: /* @__PURE__ */ new Date() }).returning();
  return row;
}
async function deleteSavedSearch(userId, id) {
  const result = await getDb().delete(savedSearches).where(and3(eq3(savedSearches.id, id), eq3(savedSearches.userId, userId))).returning({ id: savedSearches.id });
  return result.length > 0;
}

// server/services/ingestion.ts
function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
function dateKey(value) {
  return value ? value.toISOString() : null;
}
function rawText(raw, keys) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}
function modalityStatus(record) {
  return normalizeProcurementStatus(record.raw);
}
function normalizeRecord(record, sourceId, sourceCode) {
  const raw = record.raw;
  const unit = raw.unidadeOrgao && typeof raw.unidadeOrgao === "object" && !Array.isArray(raw.unidadeOrgao) ? raw.unidadeOrgao : {};
  const controlNumber = record.controlNumber?.trim() || null;
  const sourceKey = record.externalId?.trim() || controlNumber;
  if (!sourceKey || sourceKey.length > 300) return null;
  const publishedAt = parseDate(record.publishedAt);
  const updatedAt = parseDate(record.updatedAt);
  const openingAt = parseDate(record.proposalOpensAt);
  const deadline = parseDate(record.proposalClosesAt);
  const yearValue = raw.anoCompra ?? raw.anoCompraPncp;
  const year = typeof yearValue === "number" && Number.isInteger(yearValue) ? yearValue : null;
  const estimatedValue = typeof record.estimatedValue === "number" ? String(record.estimatedValue) : null;
  const awardedValue = typeof record.awardedValue === "number" ? String(record.awardedValue) : null;
  return {
    connectorId: sourceId,
    sourceKey,
    controlNumber,
    procurementNumber: rawText(raw, ["numeroCompra", "sequencialCompra"]),
    processNumber: rawText(raw, ["processo", "numeroProcesso"]),
    year,
    modality: record.modalityName ?? (record.modalityCode !== null ? `Modalidade ${record.modalityCode}` : null),
    procurementType: rawText(raw, ["tipoInstrumentoConvocatorioNomePncp", "tipoInstrumentoConvocatorioNome"]),
    title: record.title?.trim() || record.description?.trim() || "Objeto n\xE3o informado",
    description: record.description,
    summary: null,
    agencyName: record.organizationName,
    unitName: record.unitName,
    agencyCnpj: record.organizationCnpj,
    state: rawText(raw, ["unidadeOrgaoUfSigla"]) ?? rawText(unit, ["ufSigla"]),
    municipality: rawText(raw, ["unidadeOrgaoMunicipioNome"]) ?? rawText(unit, ["municipioNome"]),
    address: null,
    publicationDate: publishedAt,
    openingDate: openingAt,
    sessionAt: parseDate(rawText(raw, ["dataSessaoPublica", "dataHoraSessao"])),
    proposalDeadline: deadline,
    estimatedValue,
    awardedValue,
    status: modalityStatus(record),
    judgmentCriterion: rawText(raw, ["criterioJulgamentoNome", "criterioJulgamento"]),
    disputeMode: rawText(raw, ["modoDisputaNome", "modoDisputaIdPncp"]),
    sourceUrl: buildPncpDetailUrl({ agencyCnpj: record.organizationCnpj, raw }),
    noticeUrl: null,
    documents: [],
    itemCount: typeof raw.quantidadeItens === "number" ? raw.quantidadeItens : null,
    lastSourceUpdateAt: updatedAt,
    lastSyncedAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date(),
    rawData: { source: record.source, raw: record.raw }
  };
}
function comparableChanges(existing, next) {
  if (!next) return null;
  const fields = [
    "procurementNumber",
    "processNumber",
    "year",
    "modality",
    "procurementType",
    "title",
    "description",
    "summary",
    "agencyName",
    "unitName",
    "agencyCnpj",
    "state",
    "municipality",
    "address",
    "publicationDate",
    "openingDate",
    "sessionAt",
    "proposalDeadline",
    "estimatedValue",
    "awardedValue",
    "status",
    "judgmentCriterion",
    "disputeMode",
    "sourceUrl",
    "noticeUrl",
    "documents",
    "itemCount",
    "lastSourceUpdateAt"
  ];
  const dateFields = /* @__PURE__ */ new Set(["publicationDate", "openingDate", "sessionAt", "proposalDeadline", "lastSourceUpdateAt"]);
  const previousValues = {};
  const newValues = {};
  for (const field of fields) {
    const oldValue = dateFields.has(field) ? dateKey(existing[field]) : existing[field];
    const newValue = dateFields.has(field) ? dateKey(next[field]) : next[field];
    if (!isDeepStrictEqual(oldValue ?? null, newValue ?? null)) {
      previousValues[field] = oldValue ?? null;
      newValues[field] = newValue ?? null;
    }
  }
  return Object.keys(previousValues).length ? { previousValues, newValues } : null;
}
function dateOnly(date, compact) {
  const iso = date.toISOString().slice(0, 10);
  return compact ? iso.replace(/-/g, "") : iso;
}
async function syncConnector(sourceCode, input = {}) {
  await ensureBuiltInConnectors();
  const db = getDb();
  const [source] = await db.select().from(connectors).where(eq4(connectors.code, sourceCode)).limit(1);
  if (!source) throw new Error("Fonte n\xE3o cadastrada.");
  if (!source.enabled) throw new Error("Esta fonte est\xE1 desativada.");
  const mode = input.mode ?? "publication";
  if (mode === "open" && sourceCode !== "pncp") {
    throw new ConnectorError("The open-proposals query is available only in the official PNCP API.", "invalid_input", sourceCode);
  }
  const daysBack = Math.min(30, Math.max(1, input.daysBack ?? 7));
  const allPages = input.allPages === true;
  const maxPages = allPages ? MAX_PAGE_LIMIT : Math.min(MAX_PAGE_LIMIT, Math.max(1, input.maxPages ?? 1));
  const modalityCodes = mode === "open" ? [] : [...new Set(input.modalityCodes?.length ? input.modalityCodes : [6])];
  const queryModalities = mode === "open" ? [void 0] : modalityCodes;
  const pageSize = input.pageSize ?? 50;
  const now = /* @__PURE__ */ new Date();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1e3);
  const runStartedAt = /* @__PURE__ */ new Date();
  const queryConcurrency = sourceCode === "compras.gov.br" ? 3 : 1;
  const runMetadata = { daysBack, modalityCodes, maxPages, allPages, pageSize, mode, queryConcurrency };
  const [run] = await db.insert(syncRuns).values({ connectorId: source.id, status: "running", startedAt: runStartedAt, metadata: runMetadata }).returning();
  await db.update(connectors).set({ status: "running", lastRunAt: runStartedAt, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(connectors.id, source.id));
  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let pagesFetched = 0;
  let reportedTotalRecords = 0;
  let hasReportedTotal = false;
  const pageStats = [];
  const failures = [];
  const durationStart = Date.now();
  try {
    for (let queryOffset = 0; queryOffset < queryModalities.length; queryOffset += queryConcurrency) {
      const modalityBatch = queryModalities.slice(queryOffset, queryOffset + queryConcurrency);
      const queryResults = await Promise.all(modalityBatch.map(async (modalityCode) => {
        try {
          const pages = sourceCode === "pncp" ? mode === "open" ? await searchPncpOpen({ dataFinal: dateOnly(now, true), page: 1, maxPages, allPages, tamanhoPagina: pageSize }) : await searchPncp({ dataInicial: dateOnly(from, true), dataFinal: dateOnly(now, true), codigoModalidadeContratacao: modalityCode, page: 1, maxPages, allPages, tamanhoPagina: pageSize }) : await searchCompras({ dataPublicacaoPncpInicial: dateOnly(from, false), dataPublicacaoPncpFinal: dateOnly(now, false), codigoModalidade: modalityCode, page: 1, maxPages, allPages, tamanhoPagina: pageSize });
          return { modalityCode, pages, error: null };
        } catch (error) {
          return { modalityCode, pages: null, error };
        }
      }));
      let queryFailure = null;
      for (const queryResult of queryResults) {
        if (!queryResult.pages) {
          queryFailure ??= { error: queryResult.error };
          continue;
        }
        const { modalityCode, pages } = queryResult;
        for (const page of pages) {
          pagesFetched++;
          pageStats.push({
            modalityCode: modalityCode ?? null,
            page: page.metadata.page,
            totalPages: page.metadata.totalPages,
            totalRecords: page.metadata.totalRecords,
            pagesRemaining: page.metadata.pagesRemaining,
            returned: page.metadata.returned
          });
          if (page.metadata.page === 1 && page.metadata.totalRecords !== null) {
            reportedTotalRecords += page.metadata.totalRecords;
            hasReportedTotal = true;
          }
          const batchSize = 100;
          for (let offset = 0; offset < page.items.length; offset += batchSize) {
            const batch = page.items.slice(offset, offset + batchSize);
            fetched += batch.length;
            const prepared = [];
            const seenSourceKeys = /* @__PURE__ */ new Set();
            const seenControlNumbers = /* @__PURE__ */ new Set();
            for (const record of batch) {
              const next = normalizeRecord(record, source.id, sourceCode);
              if (!next || seenSourceKeys.has(next.sourceKey) || next.controlNumber && seenControlNumbers.has(next.controlNumber)) {
                skipped++;
                continue;
              }
              seenSourceKeys.add(next.sourceKey);
              if (next.controlNumber) seenControlNumbers.add(next.controlNumber);
              prepared.push({ record, next });
            }
            if (!prepared.length) continue;
            const sourceKeys = prepared.map(({ next }) => next.sourceKey);
            const controlNumbers = [...new Set(prepared.map(({ next }) => next.controlNumber).filter((value) => Boolean(value)))];
            const sameSourceCondition = and4(eq4(opportunities.connectorId, source.id), inArray2(opportunities.sourceKey, sourceKeys));
            const lookupConditions = [sameSourceCondition];
            if (controlNumbers.length) lookupConditions.push(inArray2(opportunities.controlNumber, controlNumbers));
            const lookupCondition = or2(...lookupConditions);
            const existingRows = lookupCondition ? await db.select().from(opportunities).where(lookupCondition) : [];
            const existingBySourceKey = new Map(existingRows.filter((row) => row.connectorId === source.id).map((row) => [row.sourceKey, row]));
            const existingByControlNumber = new Map(existingRows.filter((row) => row.controlNumber).map((row) => [row.controlNumber, row]));
            const inserts = [];
            const unchangedRows = [];
            const pendingUpdates = [];
            for (const { record, next } of prepared) {
              const existing = existingBySourceKey.get(next.sourceKey) ?? (next.controlNumber ? existingByControlNumber.get(next.controlNumber) : void 0);
              if (!existing) {
                inserts.push(next);
                continue;
              }
              const change = comparableChanges(existing, next);
              const existingRaw = existing.rawData && typeof existing.rawData === "object" ? existing.rawData : {};
              const { connectorId: _incomingConnectorId, sourceKey: _incomingSourceKey, ...incomingValues } = next;
              const rawData = existing.connectorId === source.id ? next.rawData : {
                ...existingRaw,
                observedSources: [.../* @__PURE__ */ new Set([
                  ...Array.isArray(existingRaw.observedSources) ? existingRaw.observedSources.filter((value) => typeof value === "string") : [],
                  sourceCode
                ])],
                rawBySource: {
                  ...existingRaw.rawBySource && typeof existingRaw.rawBySource === "object" ? existingRaw.rawBySource : {},
                  [sourceCode]: record.raw
                }
              };
              if (!change && isDeepStrictEqual(existingRaw, rawData)) {
                unchangedRows.push(existing);
                continue;
              }
              pendingUpdates.push({
                existing,
                values: {
                  ...existing.connectorId === source.id ? next : incomingValues,
                  lastSyncedAt: /* @__PURE__ */ new Date(),
                  rawData,
                  updatedAt: /* @__PURE__ */ new Date()
                },
                change
              });
            }
            const upsertRows = [
              ...unchangedRows.map((existing) => ({ ...existing, lastSyncedAt: /* @__PURE__ */ new Date() })),
              ...pendingUpdates.map(({ existing, values }) => ({ ...existing, ...values }))
            ];
            if (inserts.length || upsertRows.length) {
              const historyRows = pendingUpdates.flatMap(({ existing, change }) => change ? [{
                opportunityId: existing.id,
                eventType: "source_update",
                summary: "A fonte oficial atualizou informa\xE7\xF5es desta oportunidade.",
                previousValues: change.previousValues,
                newValues: change.newValues
              }] : []);
              const createdCount = await db.transaction(async (tx) => {
                let createdRows = 0;
                if (inserts.length) {
                  const created = await tx.insert(opportunities).values(inserts).onConflictDoNothing().returning({ id: opportunities.id });
                  createdRows = created.length;
                }
                if (upsertRows.length) await tx.insert(opportunities).values(upsertRows).onConflictDoUpdate({
                  target: opportunities.id,
                  set: {
                    connectorId: sql`excluded.connector_id`,
                    sourceKey: sql`excluded.source_key`,
                    controlNumber: sql`excluded.control_number`,
                    procurementNumber: sql`excluded.procurement_number`,
                    processNumber: sql`excluded.process_number`,
                    year: sql`excluded.year`,
                    modality: sql`excluded.modality`,
                    procurementType: sql`excluded.procurement_type`,
                    title: sql`excluded.title`,
                    description: sql`excluded.description`,
                    summary: sql`excluded.summary`,
                    agencyName: sql`excluded.agency_name`,
                    unitName: sql`excluded.unit_name`,
                    agencyCnpj: sql`excluded.agency_cnpj`,
                    state: sql`excluded.state`,
                    municipality: sql`excluded.municipality`,
                    address: sql`excluded.address`,
                    publicationDate: sql`excluded.publication_date`,
                    openingDate: sql`excluded.opening_date`,
                    sessionAt: sql`excluded.session_at`,
                    proposalDeadline: sql`excluded.proposal_deadline`,
                    estimatedValue: sql`excluded.estimated_value`,
                    awardedValue: sql`excluded.awarded_value`,
                    status: sql`excluded.status`,
                    judgmentCriterion: sql`excluded.judgment_criterion`,
                    disputeMode: sql`excluded.dispute_mode`,
                    sourceUrl: sql`excluded.source_url`,
                    noticeUrl: sql`excluded.notice_url`,
                    documents: sql`excluded.documents`,
                    itemCount: sql`excluded.item_count`,
                    lastSourceUpdateAt: sql`excluded.last_source_update_at`,
                    lastSyncedAt: sql`excluded.last_synced_at`,
                    rawData: sql`excluded.raw_data`,
                    updatedAt: sql`excluded.updated_at`
                  }
                });
                if (historyRows.length) await tx.insert(opportunityHistory).values(historyRows);
                return createdRows;
              });
              inserted += createdCount;
              skipped += inserts.length - createdCount;
              updated += historyRows.length;
            }
          }
        }
      }
      if (queryFailure) throw queryFailure.error;
    }
    const duration = Date.now() - durationStart;
    await db.update(syncRuns).set({ status: "completed", finishedAt: /* @__PURE__ */ new Date(), fetchedCount: fetched, insertedCount: inserted, updatedCount: updated, errorCount: failures.length, metadata: { ...runMetadata, pagesFetched, pageStats, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, skipped } }).where(eq4(syncRuns.id, run.id));
    await db.update(connectors).set({ status: "active", importedCount: source.importedCount + inserted, errorCount: source.errorCount, lastError: null, averageDurationMs: duration, nextRunAt: new Date(Date.now() + source.frequencySeconds * 1e3), updatedAt: /* @__PURE__ */ new Date() }).where(eq4(connectors.id, source.id));
    return { sourceCode, mode, pagesFetched, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, fetched, inserted, updated, skipped, durationMs: duration, runId: run.id };
  } catch (error) {
    const duration = Date.now() - durationStart;
    const errorCode = error instanceof ConnectorError ? `${error.code}${error.status ? `_${error.status}` : ""}` : "sync_failed";
    await db.update(syncRuns).set({ status: "failed", finishedAt: /* @__PURE__ */ new Date(), fetchedCount: fetched, insertedCount: inserted, updatedCount: updated, errorCount: 1, errorSummary: errorCode, metadata: { ...runMetadata, pagesFetched, pageStats, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, skipped } }).where(eq4(syncRuns.id, run.id));
    await db.update(connectors).set({ status: "error", errorCount: source.errorCount + 1, lastError: errorCode, averageDurationMs: duration, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(connectors.id, source.id));
    throw new Error(`Falha ao consultar a fonte oficial (${errorCode}).`);
  }
}

// server/routers.ts
var emailSchema = z2.string().trim().email().max(320).transform((value) => value.toLowerCase());
var registerSchema = z2.object({
  name: z2.string().trim().min(2).max(160),
  email: emailSchema,
  phone: z2.string().trim().max(40).optional().or(z2.literal("")),
  password: z2.string().min(10).max(128),
  companyName: z2.string().trim().min(2).max(240),
  cnpj: z2.string().trim().max(18).optional().or(z2.literal("")),
  state: z2.string().trim().length(2).optional().or(z2.literal("")),
  municipality: z2.string().trim().max(160).optional().or(z2.literal("")),
  segment: z2.string().trim().max(200).optional().or(z2.literal(""))
});
var loginSchema = z2.object({ email: emailSchema, password: z2.string().min(1).max(128) });
var stateCodes = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
var opportunitySearchSchema = z2.object({
  query: z2.string().trim().max(160).optional(),
  states: z2.array(z2.enum(stateCodes)).max(27).optional(),
  municipality: z2.string().trim().max(160).optional(),
  modalities: z2.array(z2.string().max(100)).max(20).optional(),
  statuses: z2.array(z2.string().max(60)).max(20).optional(),
  source: z2.enum(["pncp", "compras.gov.br"]).optional(),
  minValue: z2.number().nonnegative().max(1e12).optional(),
  maxValue: z2.number().nonnegative().max(1e12).optional(),
  publishedFrom: z2.string().datetime().optional(),
  publishedTo: z2.string().datetime().optional(),
  deadlineFrom: z2.string().datetime().optional(),
  deadlineTo: z2.string().datetime().optional(),
  onlyOpen: z2.boolean().optional(),
  page: z2.number().int().min(1).max(1e5).optional(),
  pageSize: z2.number().int().min(25).max(25).optional()
}).refine((value) => value.minValue === void 0 || value.maxValue === void 0 || value.minValue <= value.maxValue, { message: "O valor m\xEDnimo n\xE3o pode superar o m\xE1ximo." });
var profileUpdateSchema = z2.object({
  legalName: z2.string().trim().min(2).max(240),
  cnpj: z2.string().trim().max(18).optional().or(z2.literal("")),
  state: z2.string().trim().length(2).optional().or(z2.literal("")),
  municipality: z2.string().trim().max(160).optional().or(z2.literal("")),
  primarySegment: z2.string().trim().max(200).optional().or(z2.literal("")),
  segments: z2.array(z2.string().trim().min(1).max(100)).max(20),
  products: z2.array(z2.string().trim().min(1).max(160)).max(100),
  services: z2.array(z2.string().trim().min(1).max(160)).max(100),
  keywords: z2.array(z2.string().trim().min(1).max(100)).max(100),
  servedStates: z2.array(z2.enum(stateCodes)).max(27),
  servedMunicipalities: z2.array(z2.string().trim().min(1).max(160)).max(100),
  catmatCodes: z2.array(z2.string().trim().min(1).max(40)).max(200),
  catserCodes: z2.array(z2.string().trim().min(1).max(40)).max(200),
  minimumValue: z2.number().nonnegative().max(1e12).nullable(),
  maximumValue: z2.number().nonnegative().max(1e12).nullable()
}).refine((value) => value.minimumValue === null || value.maximumValue === null || value.minimumValue <= value.maximumValue, { message: "O valor m\xEDnimo n\xE3o pode superar o m\xE1ximo." });
function setAuthCookies(req, res, token) {
  const base = getSessionCookieOptions(req);
  const cookieResponse = res;
  cookieResponse.cookie(AUTH_COOKIE_NAME, token, { ...base, maxAge: SESSION_TTL_MS });
  const request = req;
  const csrf = parseCookieHeader2(request.headers.cookie ?? "")[CSRF_COOKIE_NAME];
  if (csrf) cookieResponse.cookie(CSRF_COOKIE_NAME, csrf, { ...base, httpOnly: false, maxAge: SESSION_TTL_MS });
}
function translateAuthError(error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
  if (code === "23505") throw new TRPCError3({ code: "CONFLICT", message: "Este e-mail ou CNPJ j\xE1 est\xE1 cadastrado." });
  if (error instanceof Error && error.message.includes("senha deve ter")) throw new TRPCError3({ code: "BAD_REQUEST", message: error.message });
  throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o. Tente novamente." });
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
      try {
        const user = await createCompanyAccount(input);
        const session = await createSession(user.id);
        setAuthCookies(ctx.req, ctx.res, session.token);
        const verificationEmailSent = await issueEmailVerification(user).catch(() => false);
        return { user, emailVerificationRequired: !user.emailVerifiedAt, verificationEmailSent };
      } catch (error) {
        translateAuthError(error);
      }
    }),
    login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
      const user = await findUserForLogin(input.email);
      if (!user || !await verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
      }
      try {
        await touchLastSignedIn(user.id);
        const { passwordHash: _passwordHash, ...safeUser } = user;
        const session = await createSession(user.id);
        setAuthCookies(ctx.req, ctx.res, session.token);
        return { user: safeUser, emailVerificationRequired: !user.emailVerifiedAt };
      } catch {
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel iniciar sua sess\xE3o. Tente novamente." });
      }
    }),
    requestEmailVerification: publicProcedure.input(z2.object({ email: emailSchema.optional() })).mutation(async ({ input, ctx }) => {
      const user = ctx.user ?? (input.email ? await findAccountByEmail(input.email) : null);
      if (!user || user.emailVerifiedAt) return { accepted: true };
      const sent = await issueEmailVerification(user).catch(() => false);
      return ctx.user ? { accepted: true, sent } : { accepted: true };
    }),
    verifyEmail: publicProcedure.input(z2.object({ token: z2.string().min(40).max(50) })).mutation(async ({ input }) => {
      if (!await verifyEmailAction(input.token)) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "O link de confirma\xE7\xE3o \xE9 inv\xE1lido ou expirou. Solicite um novo e-mail." });
      }
      return { verified: true };
    }),
    requestPasswordReset: publicProcedure.input(z2.object({ email: emailSchema })).mutation(async ({ input }) => {
      const user = await findAccountByEmail(input.email);
      if (user) await issuePasswordReset(user).catch(() => false);
      return { accepted: true };
    }),
    resetPassword: publicProcedure.input(z2.object({ token: z2.string().min(40).max(50), password: z2.string().min(10).max(128) })).mutation(async ({ input }) => {
      if (!await resetPasswordAction(input.token, input.password)) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "O link de redefini\xE7\xE3o \xE9 inv\xE1lido ou expirou. Solicite outro." });
      }
      return { reset: true };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeSession(getSessionToken(ctx.req));
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(AUTH_COOKIE_NAME, { ...options, maxAge: 0 });
      return { success: true };
    })
  }),
  account: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const [row] = await getDb().select({ company: companies, profile: companyProfiles, memberRole: companyMembers.memberRole }).from(companyMembers).innerJoin(companies, eq5(companyMembers.companyId, companies.id)).leftJoin(companyProfiles, eq5(companyProfiles.companyId, companies.id)).where(eq5(companyMembers.userId, ctx.user.id)).limit(1);
      if (!row) throw new TRPCError3({ code: "NOT_FOUND", message: "N\xE3o h\xE1 empresa vinculada a esta conta." });
      return { ...row.company, profile: row.profile, memberRole: row.memberRole };
    }),
    updateProfile: protectedProcedure.input(profileUpdateSchema).mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const [membership] = await tx.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq5(companyMembers.userId, ctx.user.id)).limit(1);
        if (!membership) throw new TRPCError3({ code: "NOT_FOUND", message: "N\xE3o h\xE1 empresa vinculada a esta conta." });
        const cnpj = input.cnpj?.replace(/\D/g, "") || null;
        await tx.update(companies).set({ legalName: input.legalName, cnpj, state: input.state?.toUpperCase() || null, municipality: input.municipality || null, primarySegment: input.primarySegment || null, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(companies.id, membership.companyId));
        const profileValues = { segments: input.segments, products: input.products, services: input.services, keywords: input.keywords, servedStates: input.servedStates, servedMunicipalities: input.servedMunicipalities, catmatCodes: input.catmatCodes, catserCodes: input.catserCodes, minimumValue: input.minimumValue === null ? null : String(input.minimumValue), maximumValue: input.maximumValue === null ? null : String(input.maximumValue), updatedAt: /* @__PURE__ */ new Date() };
        await tx.insert(companyProfiles).values({ companyId: membership.companyId, ...profileValues }).onConflictDoUpdate({ target: companyProfiles.companyId, set: profileValues });
        return { saved: true };
      });
    })
  }),
  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => getDashboardSummary(ctx.user))
  }),
  opportunities: router({
    search: protectedProcedure.input(opportunitySearchSchema).query(({ input, ctx }) => searchOpportunities(input, ctx.user.id)),
    detail: protectedProcedure.input(z2.object({ id: z2.string().uuid() })).query(async ({ input, ctx }) => {
      const result = await getOpportunityDetail(input.id, ctx.user.id);
      if (!result) throw new TRPCError3({ code: "NOT_FOUND", message: "A oportunidade n\xE3o foi encontrada." });
      return result;
    })
  }),
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => listFavorites(ctx.user.id)),
    toggle: protectedProcedure.input(z2.object({ opportunityId: z2.string().uuid() })).mutation(async ({ input, ctx }) => {
      const exists = await getDb().select({ id: opportunities.id }).from(opportunities).where(eq5(opportunities.id, input.opportunityId)).limit(1);
      if (!exists.length) throw new TRPCError3({ code: "NOT_FOUND", message: "A oportunidade n\xE3o foi encontrada." });
      return { favorited: await toggleFavorite(ctx.user.id, input.opportunityId) };
    })
  }),
  savedSearches: router({
    list: protectedProcedure.query(({ ctx }) => listSavedSearches(ctx.user.id)),
    create: protectedProcedure.input(z2.object({ name: z2.string().trim().min(1).max(100), criteria: z2.record(z2.string(), z2.unknown()) })).mutation(({ input, ctx }) => saveSearch(ctx.user.id, input.name, input.criteria)),
    delete: protectedProcedure.input(z2.object({ id: z2.string().uuid() })).mutation(({ input, ctx }) => deleteSavedSearch(ctx.user.id, input.id))
  }),
  admin: router({
    overview: sourceOperatorProcedure.query(async () => {
      await ensureBuiltInConnectors();
      const db = getDb();
      const [userCount, opportunityCount, sourceRows, activeSubscribers, canceledSubscriptions] = await Promise.all([
        db.select({ n: count2() }).from(users),
        db.select({ n: count2() }).from(opportunities),
        db.select().from(connectors),
        db.select({ n: count2() }).from(subscriptions).where(eq5(subscriptions.status, "active")),
        db.select({ n: count2() }).from(subscriptions).where(inArray3(subscriptions.status, ["cancelled", "canceled"]))
      ]);
      return { users: userCount[0]?.n ?? 0, opportunities: opportunityCount[0]?.n ?? 0, sourceCount: sourceRows.length, sources: sourceRows, activeSubscribers: activeSubscribers[0]?.n ?? 0, canceledSubscriptions: canceledSubscriptions[0]?.n ?? 0 };
    }),
    sources: router({
      list: sourceOperatorProcedure.query(async () => {
        await ensureBuiltInConnectors();
        const db = getDb();
        const [sources, runs] = await Promise.all([
          db.select().from(connectors).orderBy(connectors.name),
          db.select({ run: syncRuns, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq5(syncRuns.connectorId, connectors.id)).orderBy(desc3(syncRuns.startedAt)).limit(50)
        ]);
        return { sources, runs };
      }),
      run: sourceOperatorProcedure.input(z2.object({
        sourceCode: z2.enum(["pncp", "compras.gov.br"]),
        daysBack: z2.number().int().min(1).max(30).default(7),
        modalityCodes: z2.array(z2.number().int().min(1).max(15)).min(1).max(3).default([6]),
        maxPages: z2.number().int().min(1).max(3).default(1)
      })).mutation(({ input }) => syncConnector(input.sourceCode, input)),
      configure: sourceOperatorProcedure.input(z2.object({
        code: z2.enum(["pncp", "compras.gov.br"]),
        enabled: z2.boolean().optional(),
        frequencySeconds: z2.number().int().min(300).max(86400).optional()
      })).mutation(async ({ input }) => {
        await ensureBuiltInConnectors();
        const changes = { updatedAt: /* @__PURE__ */ new Date() };
        if (input.enabled !== void 0) changes.enabled = input.enabled;
        if (input.frequencySeconds !== void 0) changes.frequencySeconds = input.frequencySeconds;
        const [source] = await getDb().update(connectors).set(changes).where(eq5(connectors.code, input.code)).returning();
        return source;
      }),
      setScheduledTask: sourceOperatorProcedure.input(z2.object({ code: z2.enum(["pncp", "compras.gov.br"]), taskUid: z2.string().trim().max(200) })).mutation(async ({ input }) => {
        await ensureBuiltInConnectors();
        const [current] = await getDb().select().from(connectors).where(eq5(connectors.code, input.code)).limit(1);
        if (!current) throw new TRPCError3({ code: "NOT_FOUND", message: "Fonte n\xE3o cadastrada." });
        const configuration = current.configuration && typeof current.configuration === "object" ? current.configuration : {};
        const nextConfiguration = { ...configuration };
        if (input.taskUid) nextConfiguration.scheduledTaskUid = input.taskUid;
        else delete nextConfiguration.scheduledTaskUid;
        const [updated] = await getDb().update(connectors).set({ configuration: nextConfiguration, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(connectors.id, current.id)).returning();
        return updated;
      })
    }),
    recentRuns: sourceOperatorProcedure.query(() => getDb().select({ run: syncRuns, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq5(syncRuns.connectorId, connectors.id)).orderBy(desc3(syncRuns.startedAt)).limit(100)),
    finance: financeProcedure.query(async () => {
      const db = getDb();
      const [activeSubscriptions, canceledSubscriptions, overdueSubscriptions, activePlans, paymentGroups] = await Promise.all([
        db.select({ n: count2() }).from(subscriptions).where(eq5(subscriptions.status, "active")),
        db.select({ n: count2() }).from(subscriptions).where(inArray3(subscriptions.status, ["cancelled", "canceled"])),
        db.select({ n: count2() }).from(subscriptions).where(inArray3(subscriptions.status, ["past_due", "expired", "inadimplente"])),
        db.select({ billingInterval: subscriptions.billingInterval, monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents }).from(subscriptions).innerJoin(plans, eq5(subscriptions.planId, plans.id)).where(eq5(subscriptions.status, "active")),
        db.select({ status: payments.status, amountCents: sum2(payments.amountCents) }).from(payments).groupBy(payments.status)
      ]);
      const mrrCents = Math.round(activePlans.reduce((total, row) => total + (row.billingInterval === "annual" ? row.annualPriceCents / 12 : row.monthlyPriceCents), 0));
      const byStatus = Object.fromEntries(paymentGroups.map((row) => [row.status, Number(row.amountCents ?? 0)]));
      return {
        configured: false,
        note: "Gateway ainda n\xE3o conectado; m\xE9tricas abaixo refletem somente registros efetivamente persistidos.",
        activeSubscriptions: activeSubscriptions[0]?.n ?? 0,
        canceledSubscriptions: canceledSubscriptions[0]?.n ?? 0,
        overdueSubscriptions: overdueSubscriptions[0]?.n ?? 0,
        mrrCents,
        arrCents: mrrCents * 12,
        paymentsByStatus: byStatus,
        approvedRevenueCents: byStatus.approved ?? 0
      };
    })
  })
});

// server/services/scheduled.ts
import { jwtVerify } from "jose";
import { parse as parseCookieHeader3 } from "cookie";
import { inArray as inArray4 } from "drizzle-orm";
var COOKIE_NAME = "app_session_id";
var CONNECTORS = ["pncp", "compras.gov.br"];
var ScheduledAuthError = class extends Error {
};
function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Required platform setting is unavailable: ${name}`);
  return value;
}
async function resolveScheduledTask(req) {
  const request = req;
  const token = parseCookieHeader3(request.headers.cookie ?? "")[COOKIE_NAME];
  if (!token)
    throw new ScheduledAuthError("Scheduled task credential is missing.");
  const projectId = requiredEnvironment("MANUS_PROJECT_ID");
  const signingSecret = requiredEnvironment("MANUS_JWT_SECRET");
  const oauthApi = requiredEnvironment("MANUS_OAUTH_API_URL").replace(
    /\/+$/,
    ""
  );
  let verifiedOpenId = "";
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(signingSecret),
      { algorithms: ["HS256"], currentDate: /* @__PURE__ */ new Date() }
    );
    if (payload.appId !== projectId || typeof payload.openId !== "string" || !payload.openId.startsWith("cron_") || typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1e3)) {
      throw new ScheduledAuthError(
        "Scheduled task credential is not valid for this project."
      );
    }
    verifiedOpenId = payload.openId;
  } catch (error) {
    if (error instanceof ScheduledAuthError) throw error;
    throw new ScheduledAuthError(
      "Scheduled task credential is invalid or expired."
    );
  }
  const response = await fetch(
    `${oauthApi}/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt_token: token, project_id: projectId }),
      signal: AbortSignal.timeout(1e4)
    }
  );
  if (!response.ok)
    throw new Error("Platform could not resolve scheduled task identity.");
  const identity = await response.json();
  if (identity.projectId !== projectId || identity.openId !== verifiedOpenId || typeof identity.taskUid !== "string" || !identity.taskUid.trim()) {
    throw new ScheduledAuthError(
      "Platform scheduled task identity did not match the credential."
    );
  }
  return identity.taskUid;
}
async function handleScheduledSync(req) {
  const taskUid = await resolveScheduledTask(req);
  const enabledSources = await getDb().select().from(connectors).where(inArray4(connectors.code, [...CONNECTORS]));
  const matched = enabledSources.find((source) => {
    const configuration = source.configuration && typeof source.configuration === "object" ? source.configuration : {};
    return source.enabled && configuration.scheduledTaskUid === taskUid;
  });
  if (!matched) return { status: "no_source_registered_for_task" };
  const result = matched.code === "pncp" ? await syncConnector("pncp", { mode: "open", allPages: true, pageSize: 50 }) : await syncConnector("compras.gov.br", {
    daysBack: 7,
    modalityCodes: [3, 5, 8, 9, 11, 12, 14, 15, 20],
    allPages: true,
    pageSize: 500
  });
  const coverage = matched.code === "pncp" ? { scope: "open_proposals_all_modalities", allPages: true } : {
    scope: "supplemental_recent_publications",
    windowDays: 7,
    modalityCodes: [3, 5, 8, 9, 11, 12, 14, 15, 20],
    allPages: true,
    historicalCoverage: false
  };
  return { status: "synchronized", coverage, ...result };
}

// server/vercel-app.ts
var serializeCookie = cookieModule.serialize;
function adaptVercelRequest(req) {
  if (!req.originalUrl) req.originalUrl = req.url ?? "/";
  if (!req.ip) {
    const forwarded = req.headers["x-forwarded-for"];
    req.ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress;
  }
  if (!req.get) req.get = (name) => {
    const value = req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  return req;
}
function adaptVercelResponse(res) {
  if (!res.locals) res.locals = {};
  if (!res.set) res.set = (field, value) => {
    if (typeof field === "string" && value !== void 0) res.setHeader(field, value);
    else if (typeof field === "object") for (const [name, headerValue] of Object.entries(field)) res.setHeader(name, headerValue);
    return res;
  };
  if (!res.status) res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  if (!res.type) res.type = (value) => {
    res.setHeader("Content-Type", `${value}; charset=utf-8`);
    return res;
  };
  if (!res.json) res.json = (body) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
    return res;
  };
  if (!res.send) res.send = (body) => {
    if (typeof body === "object" && body !== null) return res.json(body);
    res.end(String(body ?? ""));
    return res;
  };
  const appendCookie = (value) => {
    const current = res.getHeader("Set-Cookie");
    const values = current ? Array.isArray(current) ? current : [String(current)] : [];
    res.setHeader("Set-Cookie", [...values, value]);
  };
  if (!res.cookie) res.cookie = (name, value, options = {}) => {
    appendCookie(serializeCookie(name, value, options));
    return res;
  };
  if (!res.clearCookie) res.clearCookie = (name, options = {}) => {
    appendCookie(serializeCookie(name, "", { ...options, expires: /* @__PURE__ */ new Date(1), maxAge: 0 }));
    return res;
  };
  return res;
}
var app = express();
app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.set("Referrer-Policy", "no-referrer");
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.post("/api/scheduled/sync", async (req, res) => {
  try {
    const result = await handleScheduledSync(req);
    res.set("Cache-Control", "no-store").status(200).json(result);
  } catch (error) {
    if (error instanceof ScheduledAuthError) {
      res.status(401).json({ error: "Scheduled task authentication failed." });
      return;
    }
    console.error("Scheduled synchronization failed.");
    res.status(500).json({ error: "Scheduled synchronization failed." });
  }
});
app.get("/api/auth/csrf", (req, res) => {
  const token = newCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, { ...getSessionCookieOptions(req), httpOnly: false, maxAge: 60 * 60 * 1e3 });
  res.set("Cache-Control", "no-store").json({ token });
});
app.get("/api/platform/config.js", (_req, res) => res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript()));
app.use("/api/trpc", (req, res, next) => {
  if (req.method !== "POST") return next();
  const cookies = parseCookieHeader4(req.headers.cookie ?? "");
  if (!constantTimeStringEqual(cookies[CSRF_COOKIE_NAME], req.get("x-csrf-token"))) {
    res.status(403).json({ error: { message: "Valida\xE7\xE3o de seguran\xE7a expirada. Recarregue a p\xE1gina." } });
    return;
  }
  next();
});
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
var vercel_app_default = app;
function handleVercelRequest(req, res) {
  app(adaptVercelRequest(req), adaptVercelResponse(res));
}
export {
  vercel_app_default as default,
  handleVercelRequest
};
