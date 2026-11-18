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
  globalSettings: () => globalSettings,
  notifications: () => notifications,
  opportunities: () => opportunities,
  opportunityActivities: () => opportunityActivities,
  opportunityHistory: () => opportunityHistory,
  opportunityItems: () => opportunityItems,
  passwordResetTokens: () => passwordResetTokens,
  payments: () => payments,
  pipelineStatusEnum: () => pipelineStatusEnum,
  planUsage: () => planUsage,
  plans: () => plans,
  savedSearches: () => savedSearches,
  subscriptions: () => subscriptions,
  supportMessages: () => supportMessages,
  supportTickets: () => supportTickets,
  syncRuns: () => syncRuns,
  userRoleEnum: () => userRoleEnum,
  users: () => users
});
import {
  boolean,
  date,
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
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
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
    itemsSyncedAt: timestamp("items_synced_at", { withTimezone: true }),
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
var planUsage = pgTable(
  "plan_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    searchesCount: integer("searches_count").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("plan_usage_company_period_unique").on(table.companyId, table.periodStart)]
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
var supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    category: text("category").default("general").notNull(),
    status: text("status").default("open").notNull(),
    priority: text("priority").default("normal").notNull(),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    index("support_tickets_user_updated_idx").on(table.userId, table.updatedAt),
    index("support_tickets_queue_idx").on(table.status, table.priority, table.lastMessageAt)
  ]
);
var supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("support_messages_ticket_created_idx").on(table.ticketId, table.createdAt)]
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
var globalSettings = pgTable("global_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type().notNull().default({}),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

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

// server/services/orberadar-validation.ts
function assessRadarNotice(n, sourceAuthorized, now = /* @__PURE__ */ new Date()) {
  const reasons = [];
  if (!sourceAuthorized) reasons.push("Fonte ainda n\xE3o autorizada para publica\xE7\xE3o autom\xE1tica");
  if (!n.object || !n.modality || !n.procurementNumber) reasons.push("Identifica\xE7\xE3o incompleta");
  if (n.matches.length) reasons.push("Poss\xEDvel duplicidade");
  const evidence = n.deadlineEvidence ?? "";
  const dates = [...evidence.matchAll(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/g)];
  const match = /\b(\d{2})\/(\d{2})\/(20\d{2})\s*(?:,|às|as|a?s)?\s*(\d{1,2})[:h](\d{2})\s*(?:h|horas)?\s*(?:\(?horário de Brasília\)?)/iu.exec(evidence);
  let deadline = null;
  if (match && dates.length === 1) {
    const d = /* @__PURE__ */ new Date(match[3] + "-" + match[2] + "-" + match[1] + "T" + match[4].padStart(2, "0") + ":" + match[5] + ":00-03:00");
    if (Number.isFinite(+d) && new Date(+d - 108e5).toISOString().slice(0, 16) === match[3] + "-" + match[2] + "-" + match[1] + "T" + match[4].padStart(2, "0") + ":" + match[5]) deadline = d;
  }
  if (!deadline || deadline <= now) reasons.push("Prazo futuro inequ\xEDvoco n\xE3o confirmado");
  return { deadline: deadline?.toISOString() ?? null, reasons, eligibleForFurtherChecks: reasons.length === 0, publishable: false };
}

// server/connectors/orberadar.ts
var MT = "https://amm.diariomunicipal.org";
var MG = "https://www.diariomunicipal.com.br";
function discoverRadarLinks(html, source) {
  const base = source === "amm-mt" ? MT : MG;
  const pattern = source === "amm-mt" ? /^\/publicacao\/(\d+)\/?$/ : /^\/amm-mg\/materia\/([0-9A-F]{8})\/?$/i;
  const seen = /* @__PURE__ */ new Map();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try {
      url = new URL(match[1], base);
    } catch {
      continue;
    }
    const id = pattern.exec(url.pathname)?.[1];
    if (url.origin !== base || !id) continue;
    const title = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!title || seen.has(id)) continue;
    seen.set(id, { source, url: base + url.pathname, title, publicationId: id, state: "review" });
  }
  return [...seen.values()];
}
function buildAmmMtSearch(from, to, page = 1) {
  if (!Number.isInteger(page) || page < 1 || page > 3 || !Number.isFinite(+from) || !Number.isFinite(+to) || +from > +to) throw new Error("Invalid radar search");
  const date2 = (d) => d.toISOString().slice(0, 10);
  const u = new URL("/publicacoes/", MT);
  u.searchParams.set("quick_terms", "licita\xE7\xF5es");
  u.searchParams.set("dates", date2(from) + "," + date2(to));
  if (page > 1) u.searchParams.set("p", String(page));
  return u;
}

// server/connectors/orberadar-notice.ts
function parseRadarNotice(candidate, plainText) {
  const text2 = plainText.normalize("NFKC").replace(/\s+/g, " ").trim();
  const field = (pattern) => pattern.exec(text2)?.[1]?.trim() || null;
  const object = field(/\bobjeto\s*[:–-]\s*(.{10,900}?)(?=\s+(?:informa[çc][õo]es|valor|data de|local|edital|in[ií]cio da sess[ãa]o|recebimento das propostas)\b|$)/iu);
  const matches = [...(candidate.title + " " + text2).normalize("NFKC").matchAll(/\b(preg[ãa]o(?:\s+(?:eletr[ôo]nico|presencial))?|concorr[êe]ncia(?:\s+(?:eletr[ôo]nica|presencial))?|dispensa(?:\s+eletr[ôo]nica)?)\s*(?:[-–:]\s*)?(?:SRP\s*)?(?:n(?:[º°o.]|\s)*\s*)?(\d+\s*\/\s*20\d{2})/giu)];
  const numbers = [...new Set(matches.map((m) => m[2].replace(/\s/g, "")))];
  const processNumber = field(/\bprocesso(?:\s+(?:administrativo|licitat[óo]rio|de licita[çc][ãa]o)){0,2}\s*[:–-]?\s*(?:n[º°o.]*\s*)?(\d+\s*\/\s*20\d{2})/iu);
  const sessionEvidence = field(/((?:data de abertura|data de realiza[çc][ãa]o|sess[ãa]o p[uú]blica|in[ií]cio da sess[ãa]o|data da sess[ãa]o|abertura da disputa|abertura das propostas)\s*[:–-]?\s*.{1,100})/iu);
  const deadlineEvidence = field(/((?:(?:encerramento|prazo final|limite|t[eé]rmino|fim)\s+(?:do recebimento|para recebimento|para envio|de envio|de recebimento)\s+(?:das |de )?propostas|(?:recebimento|envio|entrega|acolhimento)\s+(?:das |de )?propostas\s*(?:at[eé]|se encerra|final)|(?:data|hor[aá]rio)\s+limite\s+(?:para\s+)?(?:recebimento|envio)\s+(?:das |de )?propostas)\s*[:–-]?\s*.{1,120})/iu);
  const explicitDeadline = deadlineEvidence ?? field(/((?:recebimento|envio|entrega|acolhimento)\s+(?:de|das)\s+propostas\s*[:–-]\s*[^.;]{0,100}?\bat[ée]\s+[^.;]{1,80})/iu);
  const reviewReasons = ["confirmar situa\xE7\xE3o e prazo na origem", "confirmar autoriza\xE7\xE3o de coleta e reutiliza\xE7\xE3o"];
  if (!object) reviewReasons.push("objeto n\xE3o identificado");
  if (numbers.length !== 1) reviewReasons.push("identificador ausente ou conflitante");
  if (!explicitDeadline) reviewReasons.push("prazo de propostas n\xE3o identificado");
  return { ...candidate, object, modality: numbers.length === 1 ? matches[0][1] : null, procurementNumber: numbers.length === 1 ? numbers[0] : null, processNumber, sessionEvidence, deadlineEvidence: explicitDeadline, reviewReasons };
}

// server/connectors/orberadar-fetch.ts
var allowed = /* @__PURE__ */ new Set(["https://amm.diariomunicipal.org", "https://www.diariomunicipal.com.br"]);
async function fetchRadarHtml(url, request = fetch) {
  if (!allowed.has(url.origin) || url.username || url.password) throw new Error("Unsupported radar origin");
  const response = await request(url, { redirect: "error", signal: AbortSignal.timeout(15e3), headers: { "User-Agent": "OrbeRadar/1.0 (public notice pilot)", Accept: "text/html" } });
  if (!response.ok) throw new Error("Radar HTTP " + response.status);
  if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("Unexpected radar content type");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing radar response");
  const decoder = new TextDecoder();
  let size = 0, html = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2e6) throw new Error("Radar response exceeds limit");
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => void 0);
    reader.releaseLock();
  }
}
function radarPlainText(html) {
  const region = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] ?? html;
  const entities = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "\xBA", ordf: "\xAA", ccedil: "\xE7", atilde: "\xE3", otilde: "\xF5", aacute: "\xE1", eacute: "\xE9", iacute: "\xED", oacute: "\xF3", uacute: "\xFA", acirc: "\xE2", ecirc: "\xEA", ocirc: "\xF4", agrave: "\xE0" };
  return region.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key) => {
    if (key.startsWith("#")) {
      const value = key[1]?.toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return value > 0 && value <= 1114111 && !(value >= 55296 && value <= 57343) ? String.fromCodePoint(value) : entity;
    }
    const decoded = entities[key.toLowerCase()];
    return decoded ? key[0] === key[0].toUpperCase() ? decoded.toUpperCase() : decoded : entity;
  }).replace(/\s+/g, " ").trim();
}
async function runAmmMtPilot(now = /* @__PURE__ */ new Date(), request = fetch) {
  const from = new Date(+now - 7 * 864e5);
  const candidates = /* @__PURE__ */ new Map();
  const failures = [];
  const pause = () => new Promise((resolve) => setTimeout(resolve, 1100));
  for (let page = 1; page <= 2; page++) {
    const links = discoverRadarLinks(await fetchRadarHtml(buildAmmMtSearch(from, now, page), request), "amm-mt");
    await pause();
    if (!links.length) break;
    for (const link of links) candidates.set(link.publicationId, link);
  }
  const notices = [];
  for (const candidate of [...candidates.values()].slice(0, 12)) {
    try {
      const plain = radarPlainText(await fetchRadarHtml(new URL(candidate.url), request));
      if (/aviso\s+(?:de\s+)?(?:abertura\s+de\s+)?licita|aviso\s+de\s+dispensa/iu.test(plain)) notices.push(parseRadarNotice(candidate, plain));
    } catch (error) {
      failures.push(candidate.publicationId + ": " + (error instanceof Error ? error.message : "unknown"));
    } finally {
      await pause();
    }
  }
  return { notices, failures };
}
async function runAmmMgPilot(ids, request = fetch) {
  const unique = [...new Set(ids.map((id) => id.toUpperCase()))];
  if (!unique.length || unique.length > 5 || unique.some((id) => !/^[A-F0-9]{8}$/.test(id))) throw new Error("Informe at\xE9 cinco identificadores AMM-MG v\xE1lidos.");
  const notices = [], failures = [];
  for (const id of unique) {
    const url = new URL("/amm-mg/materia/" + id, "https://www.diariomunicipal.com.br");
    try {
      const plain = radarPlainText(await fetchRadarHtml(url, request));
      if (!/\b(?:licita[çc][ãa]o|preg[ãa]o|concorr[êe]ncia|dispensa)\b/iu.test(plain)) throw new Error("Mat\xE9ria sem evid\xEAncia de licita\xE7\xE3o");
      notices.push(parseRadarNotice({ source: "amm-mg", url: url.href, title: "Mat\xE9ria AMM-MG " + id, publicationId: id, state: "review" }, plain));
    } catch (error) {
      failures.push(id + ": " + (error instanceof Error ? error.message : "unknown"));
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  return { notices, failures };
}
function buildAmmMgSearch(from, to, title, page = 1) {
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to || !Number.isInteger(page) || page < 1 || page > 2 || !["preg\xE3o", "licita\xE7\xE3o", "dispensa"].includes(title)) throw new Error("Invalid AMM-MG search");
  const url = new URL("/amm-mg/pesquisar", "https://www.diariomunicipal.com.br");
  const date2 = (d) => d.toISOString().slice(0, 10);
  url.searchParams.set("busca_avancada[dataInicio]", date2(from));
  url.searchParams.set("busca_avancada[dataFim]", date2(to));
  url.searchParams.set("busca_avancada[titulo]", title);
  url.searchParams.set("busca_avancada[ordenacao]", "recente");
  url.searchParams.set("busca_avancada[pagina]", String(page));
  return url;
}
async function runAmmMgDiscovery(now = /* @__PURE__ */ new Date(), request = fetch) {
  const from = new Date(+now - 7 * 864e5);
  const candidates = /* @__PURE__ */ new Map();
  const failures = [];
  for (const term of ["preg\xE3o", "licita\xE7\xE3o", "dispensa"]) {
    for (let page = 1; page <= 2; page++) {
      try {
        const html = await fetchRadarHtml(buildAmmMgSearch(from, now, term, page), request);
        if (/captcha|acesso automatizado bloqueado|verifique que voc[eê] [eé] humano/iu.test(radarPlainText(html))) throw new Error("Portal exige verifica\xE7\xE3o humana");
        const links = discoverRadarLinks(html, "amm-mg");
        for (const link of links) candidates.set(link.publicationId, link);
        if (!links.length) break;
      } catch (error) {
        failures.push("Busca " + term + " p\xE1gina " + page + ": " + (error instanceof Error ? error.message : "unknown"));
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  if (!candidates.size) throw new Error("AMM-MG: pesquisa p\xFAblica n\xE3o retornou links de mat\xE9rias; " + failures.join("; "));
  const notices = [];
  for (const link of [...candidates.values()].slice(0, 12)) {
    try {
      const plain = radarPlainText(await fetchRadarHtml(new URL(link.url), request));
      if (/\\b(?:aviso de licita[çc][ãa]o|preg[ãa]o eletr[ôo]nico|concorr[êe]ncia eletr[ôo]nica|aviso de dispensa|credenciamento)\\b/iu.test(plain)) notices.push(parseRadarNotice(link, plain));
    } catch (error) {
      failures.push(link.publicationId + ": " + (error instanceof Error ? error.message : "unknown"));
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return { notices, failures };
}

// server/services/orberadar-compare.ts
import { eq as eq2 } from "drizzle-orm";
var normalize = (s) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
var number = (s) => {
  const m = /^(\d+)\s*\/\s*(20\d{2})$/.exec(s?.trim() ?? "");
  return m ? Number(m[1]) + "/" + m[2] : "";
};
var tokens = (s) => new Set(normalize(s).split(" ").filter((w) => w.length > 3 && !["para", "pela", "pelo", "eventual", "futura", "registro", "precos", "aquisicao", "contratacao"].includes(w)));
function similarity(a, b) {
  const x = tokens(a), y = tokens(b);
  if (x.size < 4 || y.size < 4) return 0;
  return [...x].filter((w) => y.has(w)).length / (/* @__PURE__ */ new Set([...x, ...y])).size;
}
async function compareRadarNotices(notices) {
  if (!notices.length) return [];
  const rows = await getDb().select({ id: opportunities.id, title: opportunities.title, municipality: opportunities.municipality, procurementNumber: opportunities.procurementNumber, processNumber: opportunities.processNumber, sourceUrl: opportunities.sourceUrl }).from(opportunities).where(eq2(opportunities.state, notices[0].source === "amm-mg" ? "MG" : "MT"));
  return notices.map((n) => {
    const context = normalize(n.title + " " + (n.object ?? ""));
    const matches = rows.flatMap((row) => {
      const city = normalize(row.municipality);
      const sameCity = city.length >= 4 && (" " + context + " ").includes(" " + city + " ");
      const sameNumber = Boolean(number(n.procurementNumber) && number(n.procurementNumber) === number(row.procurementNumber));
      const sameProcess = Boolean(number(n.processNumber) && number(n.processNumber) === number(row.processNumber));
      const score = similarity(n.object ?? n.title, row.title);
      const exactUrl = row.sourceUrl === n.url;
      if (!exactUrl && !(sameCity && (sameNumber || sameProcess || score >= 0.65)) && score < 0.85) return [];
      return [{ id: row.id, title: row.title, reason: exactUrl ? "URL coincidente" : sameCity && (sameNumber || sameProcess) ? "Munic\xEDpio e numera\xE7\xE3o coincidentes" : "Objeto semelhante", score: exactUrl ? 2 : sameCity && (sameNumber || sameProcess) ? 1 + score : score }];
    }).sort((a, b) => b.score - a.score).slice(0, 5);
    return { ...n, comparison: matches.length ? "possible_duplicate" : "no_match_found", matches };
  });
}

// server/services/orberadar-staging.ts
async function persistRadarRun(source, startedAt, notices, failures) {
  if (notices.some((n) => n.source !== source)) throw new Error("Mixed radar sources");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const run = await client.query(`insert into orberadar_private.runs(source, started_at, finished_at, status, candidate_count, failures) values ($1,$2,now(),$3,$4,$5::jsonb) returning id`, [source, startedAt, failures.length ? notices.length ? "partial" : "failed" : "completed", notices.length, JSON.stringify(failures)]);
    const runId = run.rows[0].id;
    for (const n of notices) {
      const candidate = await client.query(`insert into orberadar_private.candidates(source,publication_id,source_url) values ($1,$2,$3) on conflict(source,publication_id) do update set last_seen_at=now(),source_url=excluded.source_url returning id`, [source, n.publicationId, n.url]);
      await client.query("insert into orberadar_private.observations(run_id,candidate_id,payload) values($1,$2,$3::jsonb)", [runId, candidate.rows[0].id, JSON.stringify(n)]);
    }
    await client.query("COMMIT");
    return { runId, count: notices.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// server/services/orberadar-automatic.ts
async function runRadarAutomatic(source = "amm-mt") {
  const lock = await getPool().connect();
  try {
    await lock.query("BEGIN");
    const result = await lock.query("select pg_try_advisory_xact_lock(481229,$1) as locked", [source === "amm-mt" ? 6 : 7]);
    if (!result.rows[0].locked) return { status: "busy" };
    const startedAt = /* @__PURE__ */ new Date();
    try {
      const extracted = source === "amm-mt" ? await runAmmMtPilot(startedAt) : await runAmmMgDiscovery(startedAt);
      const notices = await compareRadarNotices(extracted.notices);
      const assessed = notices.map((n) => ({ ...n, automaticAssessment: assessRadarNotice(n, false, startedAt) }));
      const saved = await persistRadarRun(source, startedAt, assessed, extracted.failures);
      return { status: "collected", ...saved };
    } catch (error) {
      await persistRadarRun("amm-mt", startedAt, [], ["Falha na extra\xE7\xE3o ou compara\xE7\xE3o autom\xE1tica"]);
      throw error;
    }
  } finally {
    try {
      await lock.query("ROLLBACK");
      lock.release();
    } catch {
      lock.release(true);
    }
  }
}

// server/services/orberadar-review.ts
async function listRadarReview() {
  const pool2 = getPool();
  const runs = await pool2.query("select id,source,started_at,finished_at,status,candidate_count,failures from orberadar_private.runs order by started_at desc limit 30");
  const candidates = await pool2.query(`select c.id,c.source,c.publication_id,c.source_url,c.first_seen_at,c.last_seen_at,c.review_status,o.payload from orberadar_private.candidates c left join lateral (select payload from orberadar_private.observations where candidate_id=c.id order by extracted_at desc limit 1) o on true order by c.last_seen_at desc limit 100`);
  return { runs: runs.rows, candidates: candidates.rows };
}
async function setRadarReview(id, status) {
  const result = await getPool().query("update orberadar_private.candidates set review_status=$2 where id=$1 and review_status in ('pending','rejected') returning id", [id, status]);
  if (!result.rowCount) throw new Error("Candidato indispon\xEDvel para revis\xE3o");
  return { id, status };
}
async function verifyRadarCandidate(id, deadline, evidence) {
  const date2 = new Date(deadline);
  if (!Number.isFinite(date2.getTime()) || date2.getTime() <= Date.now()) throw new Error("Informe um prazo futuro confirmado na origem");
  if (evidence.trim().length < 15) throw new Error("Informe a evid\xEAncia da valida\xE7\xE3o");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("update orberadar_private.candidates set review_status='verified' where id=$1 and review_status='pending' returning id", [id]);
    if (!result.rowCount) throw new Error("Candidato n\xE3o est\xE1 pendente");
    await client.query("insert into orberadar_private.review_events(candidate_id,deadline,evidence) values($1,$2,$3)", [id, date2, evidence.trim()]);
    await client.query("COMMIT");
    return { id, status: "verified" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// server/routers.ts
import { parse as parseCookieHeader2 } from "cookie";
import { TRPCError as TRPCError7 } from "@trpc/server";
import { and as and12, count as count5, desc as desc9, eq as eq14, gte as gte3, inArray as inArray10, isNotNull, lt as lt3, or as or8, sql as sql6, sum as sum2 } from "drizzle-orm";
import { z as z5 } from "zod";

// server/services/authActions.ts
import { createHash as createHash3, randomBytes as randomBytes2 } from "node:crypto";
import { and as and2, desc, eq as eq3, gt as gt2 } from "drizzle-orm";

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
  const [recent] = await db.select({ createdAt: emailVerifications.createdAt }).from(emailVerifications).where(eq3(emailVerifications.userId, user.id)).orderBy(desc(emailVerifications.createdAt)).limit(1);
  if (recent && now.getTime() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) return false;
  const action = newActionToken();
  await db.transaction(async (tx) => {
    await tx.delete(emailVerifications).where(eq3(emailVerifications.userId, user.id));
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
    const [action] = await tx.delete(emailVerifications).where(and2(eq3(emailVerifications.tokenHash, hashActionToken(token)), gt2(emailVerifications.expiresAt, now))).returning({ userId: emailVerifications.userId });
    if (!action) return false;
    await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq3(users.id, action.userId));
    await tx.delete(emailVerifications).where(eq3(emailVerifications.userId, action.userId));
    return true;
  });
}
async function issuePasswordReset(user) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const [recent] = await db.select({ createdAt: passwordResetTokens.createdAt }).from(passwordResetTokens).where(eq3(passwordResetTokens.userId, user.id)).orderBy(desc(passwordResetTokens.createdAt)).limit(1);
  if (recent && now.getTime() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) return false;
  const action = newActionToken();
  await db.transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq3(passwordResetTokens.userId, user.id));
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
    const [action] = await tx.delete(passwordResetTokens).where(and2(eq3(passwordResetTokens.tokenHash, hashActionToken(token)), gt2(passwordResetTokens.expiresAt, now))).returning({ userId: passwordResetTokens.userId });
    if (!action) return false;
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq3(users.id, action.userId));
    await tx.delete(passwordResetTokens).where(eq3(passwordResetTokens.userId, action.userId));
    await tx.delete(authSessions).where(eq3(authSessions.userId, action.userId));
    return true;
  });
}
async function findAccountByEmail(email) {
  const [user] = await getDb().select().from(users).where(eq3(users.email, email)).limit(1);
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

// server/adminUsersRouter.ts
import { and as and5, count, desc as desc4, eq as eq6, ilike, inArray as inArray3, or as or2, sql } from "drizzle-orm";
import { z } from "zod";

// shared/const.ts
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { and as and3, desc as desc2, eq as eq4, or } from "drizzle-orm";
var t = initTRPC.context().create({ transformer: superjson });
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (ctx.user.suspendedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta est\xE1 suspensa. Entre em contato com o suporte do OrbeEdital." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var requireVerifiedEmail = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user?.emailVerifiedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Confirme seu e-mail para acessar os recursos do OrbeEdital." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var authenticatedProcedure = t.procedure.use(requireUser);
var requireActiveSubscription = t.middleware(async ({ ctx, next }) => {
  if (["superadmin", "admin", "source_operator", "support", "finance"].includes(ctx.user.role)) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  const [membership] = await getDb().select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq4(companyMembers.userId, ctx.user.id)).limit(1);
  const [active] = membership ? await getDb().select({ id: subscriptions.id }).from(subscriptions).innerJoin(plans, eq4(subscriptions.planId, plans.id)).leftJoin(payments, eq4(payments.subscriptionId, subscriptions.id)).where(and3(eq4(subscriptions.companyId, membership.companyId), eq4(subscriptions.status, "active"), eq4(plans.active, true), or(eq4(payments.status, "approved"), and3(eq4(plans.monthlyPriceCents, 0), eq4(subscriptions.provider, "orbeedital"))))).orderBy(desc2(subscriptions.createdAt)).limit(1) : [];
  if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "Sua assinatura ainda n\xE3o est\xE1 ativa. Conclua o pagamento do plano para acessar o portal." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var protectedProcedure = t.procedure.use(requireUser).use(requireVerifiedEmail).use(requireActiveSubscription);
function requireRoles(roles) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (ctx.user.suspendedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta est\xE1 suspensa. Entre em contato com o suporte do OrbeEdital." });
    if (!ctx.user.emailVerifiedAt) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Confirme seu e-mail para acessar os recursos do OrbeEdital." });
    }
    if (!roles.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}
var adminProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "source_operator", "support", "finance"]));
var sourceOperatorProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "source_operator"]));
var financeProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "finance"]));
var superadminProcedure = t.procedure.use(requireRoles(["superadmin"]));

// server/adminUsersRouter.ts
import { TRPCError as TRPCError2 } from "@trpc/server";

// server/services/mercadoPago.ts
import { createHmac, randomUUID, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { and as and4, desc as desc3, eq as eq5, inArray as inArray2, lt } from "drizzle-orm";
var MP_API = "https://api.mercadopago.com";
var SITE_URL = (process.env.APP_URL || "https://orbeedital.vercel.app").replace(/\/$/, "");
function accessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago n\xE3o configurado.");
  return token;
}
async function mpRequest(path, init = {}) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...init.headers || {}
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = body && typeof body === "object" ? body : {};
    const causes = Array.isArray(apiError.cause) ? apiError.cause.map((item) => ({
      code: typeof item?.code === "string" || typeof item?.code === "number" ? item.code : void 0,
      description: typeof item?.description === "string" ? item.description.slice(0, 300) : void 0
    })) : [];
    console.error("[mercadopago] API request rejected", {
      status: response.status,
      error: typeof apiError.error === "string" ? apiError.error : void 0,
      message: typeof apiError.message === "string" ? apiError.message.slice(0, 300) : void 0,
      causes
    });
    const detail = causes.map((item) => item.description || item.code).filter(Boolean).join("; ") || (typeof apiError.message === "string" ? apiError.message : "");
    throw new Error(detail ? `O Mercado Pago recusou a solicita\xE7\xE3o: ${detail}` : "O Mercado Pago recusou a solicita\xE7\xE3o. Verifique as configura\xE7\xF5es e tente novamente.");
  }
  return body;
}
async function createMercadoPagoCheckout(userId, planId, interval) {
  const db = getDb();
  const [membership] = await db.select({
    company: companies,
    email: users.email
  }).from(companyMembers).innerJoin(companies, eq5(companyMembers.companyId, companies.id)).innerJoin(users, eq5(companyMembers.userId, users.id)).where(eq5(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Sua conta n\xE3o possui uma empresa vinculada.");
  const [plan] = await db.select().from(plans).where(and4(eq5(plans.id, planId), eq5(plans.active, true))).limit(1);
  if (!plan) throw new Error("Plano indispon\xEDvel.");
  const amountCents = interval === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("Pre\xE7o do plano inv\xE1lido.");
  if (amountCents === 0) {
    if (plan.code !== "teste-gratis") throw new Error("Este plano gratuito n\xE3o est\xE1 dispon\xEDvel para ativa\xE7\xE3o autom\xE1tica.");
    const [existing] = await db.select({ id: subscriptions.id }).from(subscriptions).where(and4(
      eq5(subscriptions.companyId, membership.company.id),
      inArray2(subscriptions.status, ["active", "trialing"])
    )).orderBy(desc3(subscriptions.createdAt)).limit(1);
    if (existing) throw new Error("Sua empresa j\xE1 possui uma assinatura ativa. Cancele ou altere o plano atual antes de ativar o plano de teste.");
    const [freeSubscription] = await db.insert(subscriptions).values({
      companyId: membership.company.id,
      planId: plan.id,
      status: "active",
      billingInterval: "monthly",
      provider: "orbeedital",
      currentPeriodStart: /* @__PURE__ */ new Date()
    }).returning({ id: subscriptions.id });
    await db.insert(auditLogs).values({
      actorUserId: userId,
      companyId: membership.company.id,
      action: "subscription.free_test.activated",
      entityType: "subscription",
      entityId: freeSubscription.id,
      details: { planCode: plan.code, amountCents: 0 }
    });
    return { checkoutUrl: `${SITE_URL}/app?plan=teste-gratis-ativado` };
  }
  const [localSubscription] = await db.insert(subscriptions).values({
    companyId: membership.company.id,
    planId: plan.id,
    status: "pending",
    billingInterval: interval,
    provider: "mercadopago"
  }).returning({ id: subscriptions.id });
  try {
    const created = await mpRequest("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `OrbeEdital - ${plan.name}`,
        external_reference: localSubscription.id,
        payer_email: membership.email,
        auto_recurring: {
          frequency: interval === "annual" ? 12 : 1,
          frequency_type: "months",
          transaction_amount: amountCents / 100,
          currency_id: "BRL"
        },
        back_url: `${SITE_URL}/app/billing?checkout=return`,
        notification_url: `${SITE_URL}/api/webhooks/mercadopago`
      })
    });
    if (!created.id || !created.init_point) throw new Error("Mercado Pago n\xE3o retornou o link de checkout.");
    await db.update(subscriptions).set({
      providerSubscriptionId: created.id,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq5(subscriptions.id, localSubscription.id));
    return { checkoutUrl: created.init_point };
  } catch (error) {
    await db.update(subscriptions).set({ status: "failed", updatedAt: /* @__PURE__ */ new Date() }).where(eq5(subscriptions.id, localSubscription.id));
    throw error;
  }
}
function validCpfCnpj(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    if (/^(\d)\1+$/.test(digits)) return false;
    const calc = (base, factor) => {
      let total = 0;
      for (const digit of base) total += Number(digit) * factor--;
      const rest = total * 10 % 11;
      return rest === 10 ? 0 : rest;
    };
    return calc(digits.slice(0, 9), 10) === Number(digits[9]) && calc(digits.slice(0, 10), 11) === Number(digits[10]);
  }
  if (digits.length === 14) {
    if (/^(\d)\1+$/.test(digits)) return false;
    const digit = (base, weights) => {
      const total = base.split("").reduce((sum3, n, i) => sum3 + Number(n) * weights[i], 0);
      const rest = total % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const first = digit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = digit(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return first === Number(digits[12]) && second === Number(digits[13]);
  }
  return false;
}
async function createMercadoPagoPix(userId, planId, interval, payerDocument) {
  const db = getDb();
  const [membership] = await db.select({ company: companies, email: users.email }).from(companyMembers).innerJoin(companies, eq5(companyMembers.companyId, companies.id)).innerJoin(users, eq5(companyMembers.userId, users.id)).where(eq5(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Sua conta n\xE3o possui uma empresa vinculada.");
  const [plan] = await db.select().from(plans).where(and4(eq5(plans.id, planId), eq5(plans.active, true))).limit(1);
  if (!plan) throw new Error("Plano indispon\xEDvel.");
  const amountCents = interval === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Este plano n\xE3o possui cobran\xE7a Pix dispon\xEDvel.");
  const companyCnpj = String(membership.company.cnpj || "").replace(/\D/g, "");
  const document = companyCnpj || String(payerDocument || "").replace(/\D/g, "");
  if (!document) throw new Error("Informe um CPF ou CNPJ para gerar o Pix.");
  if (!validCpfCnpj(document)) throw new Error(companyCnpj ? "O CNPJ cadastrado da empresa \xE9 inv\xE1lido. Atualize o cadastro antes de pagar." : "O CPF ou CNPJ informado \xE9 inv\xE1lido.");
  const documentType = document.length === 14 ? "CNPJ" : "CPF";
  const [localSubscription] = await db.insert(subscriptions).values({
    companyId: membership.company.id,
    planId: plan.id,
    status: "pending",
    billingInterval: interval,
    provider: "mercadopago"
  }).returning({ id: subscriptions.id });
  try {
    const expiration = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    const created = await mpRequest("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        transaction_amount: amountCents / 100,
        description: `OrbeEdital - ${plan.name} (${interval === "annual" ? "anual" : "mensal"})`,
        payment_method_id: "pix",
        external_reference: localSubscription.id,
        notification_url: `${SITE_URL}/api/webhooks/mercadopago`,
        date_of_expiration: expiration.toISOString(),
        payer: { email: membership.email, identification: { type: documentType, number: document } }
      })
    });
    const transaction = created.point_of_interaction?.transaction_data;
    if (!created.id || !transaction?.qr_code || !transaction?.qr_code_base64) {
      throw new Error("O Mercado Pago n\xE3o retornou os dados do QR Code Pix.");
    }
    const pixData = {
      pixQrCode: String(transaction.qr_code),
      pixQrCodeBase64: String(transaction.qr_code_base64),
      pixTicketUrl: transaction.ticket_url ? String(transaction.ticket_url) : null,
      expiresAt: created.date_of_expiration || expiration.toISOString()
    };
    await db.insert(payments).values({
      subscriptionId: localSubscription.id,
      companyId: membership.company.id,
      provider: "mercadopago",
      providerPaymentId: String(created.id),
      amountCents,
      currency: "BRL",
      status: String(created.status || "pending"),
      rawStatus: JSON.stringify(pixData)
    });
    return { paymentId: String(created.id), ...pixData, amountCents, planName: plan.name };
  } catch (error) {
    await db.update(subscriptions).set({ status: "failed", updatedAt: /* @__PURE__ */ new Date() }).where(eq5(subscriptions.id, localSubscription.id));
    throw error;
  }
}
async function verifyMercadoPagoPayments(userId) {
  const db = getDb();
  const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq5(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Empresa n\xE3o encontrada.");
  let checked = 0;
  let activated = 0;
  const pixPayments = await db.select().from(payments).where(and4(
    eq5(payments.companyId, membership.companyId),
    eq5(payments.provider, "mercadopago")
  )).orderBy(desc3(payments.createdAt)).limit(30);
  for (const payment of pixPayments) {
    let metadata = {};
    try {
      metadata = JSON.parse(payment.rawStatus || "{}");
    } catch {
    }
    if (!metadata.pixQrCode || !payment.providerPaymentId) continue;
    checked += 1;
    const result = await getMercadoPagoPixStatus(userId, payment.providerPaymentId).catch((error) => {
      console.warn("[billing.verifyPayment] Pix reconciliation failed:", error instanceof Error ? error.message : "unknown");
      return null;
    });
    if (result?.status === "approved") activated += 1;
  }
  const pendingSubscriptions = await db.select().from(subscriptions).where(and4(
    eq5(subscriptions.companyId, membership.companyId),
    eq5(subscriptions.provider, "mercadopago"),
    inArray2(subscriptions.status, ["pending", "past_due"])
  )).orderBy(desc3(subscriptions.createdAt)).limit(20);
  for (const local of pendingSubscriptions) {
    if (!local.providerSubscriptionId) continue;
    checked += 1;
    const remote = await mpRequest(`/preapproval/${encodeURIComponent(local.providerSubscriptionId)}`);
    if (String(remote.id) !== String(local.providerSubscriptionId) || String(remote.external_reference || "") !== String(local.id)) continue;
    if (remote.status === "cancelled") {
      await db.update(subscriptions).set({ status: "cancelled", cancelledAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq5(subscriptions.id, local.id));
      continue;
    }
    if (remote.status === "paused") {
      await db.update(subscriptions).set({ status: "past_due", updatedAt: /* @__PURE__ */ new Date() }).where(eq5(subscriptions.id, local.id));
    }
    const invoiceSearch = await mpRequest(
      `/authorized_payments/search?preapproval_id=${encodeURIComponent(local.providerSubscriptionId)}`
    );
    const invoices = Array.isArray(invoiceSearch.results) ? invoiceSearch.results : [];
    for (const invoice of invoices) {
      const paymentId = String(invoice.payment?.id || "");
      if (!paymentId) continue;
      const remotePayment = await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
      if (String(remotePayment.id) !== paymentId || String(remotePayment.status || "") !== "approved" || String(remotePayment.currency_id || "BRL") !== "BRL" || Math.round(Number(remotePayment.transaction_amount || 0) * 100) !== Math.round(Number(invoice.transaction_amount || 0) * 100)) continue;
      const amountCents = Math.round(Number(remotePayment.transaction_amount) * 100);
      await db.insert(payments).values({
        subscriptionId: local.id,
        companyId: local.companyId,
        provider: "mercadopago",
        providerPaymentId: paymentId,
        amountCents,
        currency: "BRL",
        status: "approved",
        paidAt: new Date(remotePayment.date_approved || remotePayment.date_created || Date.now()),
        rawStatus: JSON.stringify({ invoiceId: String(invoice.id || ""), reconciledBy: "billing.verifyPayment" })
      }).onConflictDoUpdate({
        target: [payments.provider, payments.providerPaymentId],
        set: {
          subscriptionId: local.id,
          companyId: local.companyId,
          amountCents,
          currency: "BRL",
          status: "approved",
          paidAt: new Date(remotePayment.date_approved || remotePayment.date_created || Date.now()),
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
      if (local.status !== "active" && local.status !== "cancelled") {
        const now = /* @__PURE__ */ new Date();
        const periodStart = local.currentPeriodStart || new Date(remotePayment.date_approved || Date.now());
        const periodEnd = new Date(periodStart);
        if (local.billingInterval === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        else periodEnd.setMonth(periodEnd.getMonth() + 1);
        await db.update(subscriptions).set({
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          gracePeriodEndsAt: null,
          updatedAt: now
        }).where(eq5(subscriptions.id, local.id));
        await db.update(subscriptions).set({
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now
        }).where(and4(
          eq5(subscriptions.companyId, local.companyId),
          inArray2(subscriptions.status, ["active", "trialing"]),
          lt(subscriptions.createdAt, local.createdAt)
        ));
        activated += 1;
      }
    }
  }
  return { checked, activated };
}
async function getMercadoPagoPixStatus(userId, paymentId) {
  const db = getDb();
  const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq5(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Empresa n\xE3o encontrada.");
  const [payment] = await db.select().from(payments).where(and4(
    eq5(payments.companyId, membership.companyId),
    eq5(payments.provider, "mercadopago"),
    eq5(payments.providerPaymentId, paymentId)
  )).limit(1);
  if (!payment) throw new Error("Cobran\xE7a Pix n\xE3o encontrada.");
  const remote = await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
  if (String(remote.id) !== paymentId || String(remote.payment_method_id || "") !== "pix" || String(remote.external_reference || "") !== String(payment.subscriptionId || "") || Math.round(Number(remote.transaction_amount || 0) * 100) !== payment.amountCents || String(remote.currency_id || "BRL") !== "BRL") {
    throw new Error("Os dados da cobran\xE7a n\xE3o correspondem ao pagamento Pix registrado.");
  }
  const paymentStatus = String(remote.status || payment.status || "pending");
  const paidAt = paymentStatus === "approved" ? new Date(remote.date_approved || Date.now()) : null;
  await db.update(payments).set({ status: paymentStatus, paidAt, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(payments.id, payment.id));
  if (paymentStatus === "approved" && payment.subscriptionId) {
    const [local] = await db.select().from(subscriptions).where(eq5(subscriptions.id, payment.subscriptionId)).limit(1);
    if (local && local.status !== "cancelled" && local.status !== "failed") {
      const now = /* @__PURE__ */ new Date();
      if (local.status !== "active") {
        const previousActives = await db.select({
          id: subscriptions.id,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          provider: subscriptions.provider,
          providerSubscriptionId: subscriptions.providerSubscriptionId
        }).from(subscriptions).where(and4(
          eq5(subscriptions.companyId, local.companyId),
          inArray2(subscriptions.status, ["active", "trialing"]),
          lt(subscriptions.createdAt, local.createdAt)
        )).orderBy(desc3(subscriptions.createdAt));
        const futurePeriodEnds = previousActives.map((item) => item.currentPeriodEnd).filter((end) => Boolean(end && end > now)).sort((a, b) => b.getTime() - a.getTime());
        const periodStart = futurePeriodEnds[0] ?? now;
        const periodEnd = new Date(periodStart);
        if (local.billingInterval === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        else periodEnd.setMonth(periodEnd.getMonth() + 1);
        await db.update(subscriptions).set({
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          gracePeriodEndsAt: null,
          updatedAt: now
        }).where(eq5(subscriptions.id, local.id));
        for (const previous of previousActives) {
          if (previous.provider === "mercadopago" && previous.providerSubscriptionId) {
            try {
              await cancelMercadoPagoSubscription(previous.id);
            } catch (error) {
              console.error("[Mercado Pago Pix] Falha ao cancelar cobran\xE7a recorrente anterior:", error);
            }
          }
        }
        await db.update(subscriptions).set({
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now
        }).where(and4(
          eq5(subscriptions.companyId, local.companyId),
          inArray2(subscriptions.status, ["active", "trialing"]),
          lt(subscriptions.createdAt, local.createdAt)
        ));
      }
    }
  }
  let pix = {};
  try {
    pix = JSON.parse(payment.rawStatus || "{}");
  } catch {
  }
  return { status: paymentStatus, paidAt, ...pix };
}
async function cancelMercadoPagoSubscription(subscriptionId) {
  const db = getDb();
  const [subscription] = await db.select().from(subscriptions).where(eq5(subscriptions.id, subscriptionId)).limit(1);
  if (!subscription || subscription.provider !== "mercadopago" || !subscription.providerSubscriptionId) {
    throw new Error("Assinatura pendente n\xE3o encontrada no Mercado Pago.");
  }
  if (subscription.status === "cancelled") return;
  try {
    await mpRequest(`/preapproval/${encodeURIComponent(subscription.providerSubscriptionId)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("you can not modify a cancelled preapproval")) {
      throw error;
    }
  }
  await db.update(subscriptions).set({
    status: "cancelled",
    cancelledAt: subscription.cancelledAt ?? /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq5(subscriptions.id, subscription.id));
}
async function changeMercadoPagoPlan(userId, planId, method = "card", payerDocument) {
  const db = getDb();
  const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq5(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Sua conta n\xE3o possui uma empresa vinculada.");
  const [targetPlan] = await db.select().from(plans).where(and4(eq5(plans.id, planId), eq5(plans.active, true))).limit(1);
  if (!targetPlan || !["essencial", "profissional"].includes(targetPlan.code)) {
    throw new Error("Plano indispon\xEDvel.");
  }
  if (targetPlan.monthlyPriceCents <= 0) throw new Error("O plano selecionado n\xE3o possui pre\xE7o mensal configurado.");
  const [current] = await db.select().from(subscriptions).where(and4(
    eq5(subscriptions.companyId, membership.companyId),
    inArray2(subscriptions.status, ["active", "trialing"])
  )).orderBy(desc3(subscriptions.createdAt)).limit(1);
  if (!current) throw new Error("N\xE3o encontramos uma assinatura ativa para alterar.");
  if (current.planId === targetPlan.id) throw new Error("Este j\xE1 \xE9 o plano atual.");
  if (method === "pix") return createMercadoPagoPix(userId, planId, "monthly", payerDocument);
  if (!current.providerSubscriptionId || current.provider !== "mercadopago") {
    return createMercadoPagoCheckout(userId, planId, "monthly");
  }
  await mpRequest(`/preapproval/${encodeURIComponent(current.providerSubscriptionId)}`, {
    method: "PUT",
    body: JSON.stringify({
      reason: `OrbeEdital - ${targetPlan.name}`,
      auto_recurring: {
        transaction_amount: targetPlan.monthlyPriceCents / 100,
        currency_id: "BRL"
      }
    })
  });
  await db.update(subscriptions).set({
    planId: targetPlan.id,
    billingInterval: "monthly",
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq5(subscriptions.id, current.id));
  await db.insert(auditLogs).values({
    actorUserId: userId,
    companyId: membership.companyId,
    action: "subscription.plan.customer_changed",
    entityType: "subscription",
    entityId: current.id,
    details: {
      previousPlanId: current.planId,
      newPlanId: targetPlan.id,
      previousPlanCode: null,
      newPlanCode: targetPlan.code,
      provider: "mercadopago"
    }
  });
  return { success: true, planName: targetPlan.name };
}
async function refundMercadoPagoPayment(paymentId, actorUserId) {
  const db = getDb();
  const [payment] = await db.select().from(payments).where(and4(
    eq5(payments.provider, "mercadopago"),
    eq5(payments.providerPaymentId, paymentId)
  )).limit(1);
  if (!payment) throw new Error("Pagamento n\xE3o encontrado.");
  if (payment.status === "refunded" || payment.status === "charged_back") {
    throw new Error("Este pagamento j\xE1 consta como estornado ou contestado.");
  }
  if (payment.status !== "approved") throw new Error("Somente pagamentos aprovados podem ser estornados.");
  const [subscription] = payment.subscriptionId ? await db.select().from(subscriptions).where(eq5(subscriptions.id, payment.subscriptionId)).limit(1) : [];
  if (subscription?.provider === "mercadopago" && subscription.providerSubscriptionId && subscription.status !== "cancelled") {
    await cancelMercadoPagoSubscription(subscription.id);
  }
  const refund = await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: "POST",
    headers: { "X-Idempotency-Key": randomUUID() },
    body: JSON.stringify({ amount: payment.amountCents / 100 })
  });
  const refundStatus = String(refund.status || "");
  if (!["approved", "processed"].includes(refundStatus)) {
    throw new Error("O Mercado Pago recebeu a solicita\xE7\xE3o, mas ainda n\xE3o confirmou o estorno. Consulte o pagamento antes de tentar novamente.");
  }
  let raw = {};
  try {
    raw = JSON.parse(payment.rawStatus || "{}");
  } catch {
  }
  raw = { ...raw, refundId: String(refund.id || ""), refundedAt: (/* @__PURE__ */ new Date()).toISOString(), refundStatus };
  await db.update(payments).set({ status: "refunded", rawStatus: JSON.stringify(raw), updatedAt: /* @__PURE__ */ new Date() }).where(eq5(payments.id, payment.id));
  if (subscription && subscription.status !== "cancelled") {
    await db.update(subscriptions).set({ status: "cancelled", cancelledAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq5(subscriptions.id, subscription.id));
  }
  await db.insert(auditLogs).values({
    actorUserId,
    companyId: payment.companyId,
    action: "payment.refunded",
    entityType: "payment",
    entityId: payment.id,
    details: { providerPaymentId: paymentId, amountCents: payment.amountCents, subscriptionId: payment.subscriptionId }
  });
  return { refunded: true, amountCents: payment.amountCents };
}
async function reconcileExternallyRefundedPayment(paymentId, actorUserId) {
  const db = getDb();
  const [payment] = await db.select().from(payments).where(and4(
    eq5(payments.provider, "mercadopago"),
    eq5(payments.providerPaymentId, paymentId)
  )).limit(1);
  if (!payment) throw new Error("Pagamento n\xE3o encontrado.");
  const remote = await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
  const remoteStatus = String(remote.status || "").toLowerCase();
  const refundedAmount = Array.isArray(remote.refunds) ? remote.refunds.reduce((total, item) => total + Number(item.amount || 0), 0) : 0;
  const transactionAmount = Number(remote.transaction_amount || payment.amountCents / 100);
  const fullyRefunded = remoteStatus === "refunded" || remoteStatus === "charged_back" || transactionAmount > 0 && refundedAmount >= transactionAmount - 0.01;
  if (!fullyRefunded) {
    throw new Error(`O Mercado Pago ainda n\xE3o confirma estorno integral (status remoto: ${remoteStatus || "desconhecido"}). Nenhum acesso foi alterado.`);
  }
  const companySubscriptions = await db.select().from(subscriptions).where(eq5(subscriptions.companyId, payment.companyId));
  for (const subscription of companySubscriptions) {
    if (subscription.status === "cancelled" || subscription.status === "canceled") continue;
    if (subscription.provider === "mercadopago" && subscription.providerSubscriptionId) {
      await cancelMercadoPagoSubscription(subscription.id);
    } else {
      const now = /* @__PURE__ */ new Date();
      await db.update(subscriptions).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq5(subscriptions.id, subscription.id));
    }
  }
  let raw = {};
  try {
    raw = JSON.parse(payment.rawStatus || "{}");
  } catch {
  }
  raw = { ...raw, refundReconciledAt: (/* @__PURE__ */ new Date()).toISOString(), remotePaymentStatus: remoteStatus, refundedAmount };
  await db.update(payments).set({
    status: "refunded",
    rawStatus: JSON.stringify(raw),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq5(payments.id, payment.id));
  await db.insert(auditLogs).values({
    actorUserId,
    companyId: payment.companyId,
    action: "payment.refund_reconciled",
    entityType: "payment",
    entityId: payment.id,
    details: { providerPaymentId: paymentId, amountCents: payment.amountCents, remoteStatus, refundedAmount, cancelledSubscriptionIds: companySubscriptions.map((item) => item.id) }
  });
  return { refunded: true, cancelledSubscriptions: companySubscriptions.length, remoteStatus, refundedAmount };
}
function validWebhookSignature(signature, requestId, dataId, secret) {
  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const index2 = part.indexOf("=");
    return index2 < 0 ? ["", ""] : [part.slice(0, index2).trim(), part.slice(index2 + 1).trim()];
  }));
  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received || !/^\d+$/.test(ts)) return false;
  if (Math.abs(Date.now() / 1e3 - Number(ts)) > 300) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual2(a, b);
}
async function handleMercadoPagoWebhook(req) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) throw new Error("Webhook secret n\xE3o configurado.");
  const signature = String(req.get("x-signature") || "");
  const requestId = String(req.get("x-request-id") || "");
  const dataId = String(req.query?.["data.id"] || req.query?.data?.id || req.query?.data_id || "");
  if (!signature || !requestId || !dataId || !validWebhookSignature(signature, requestId, dataId, secret)) {
    const error = new Error("Assinatura de webhook inv\xE1lida.");
    error.statusCode = 401;
    throw error;
  }
  const type = String(req.body?.type || req.query?.type || "");
  if (type === "payment") {
    const remote = await mpRequest(`/v1/payments/${encodeURIComponent(dataId)}`);
    if (String(remote.payment_method_id || "") !== "pix") return;
    const localId = String(remote.external_reference || "");
    if (!localId) return;
    const [local] = await getDb().select().from(subscriptions).where(eq5(subscriptions.id, localId)).limit(1);
    if (!local || local.provider !== "mercadopago") return;
    const [localPayment] = await getDb().select().from(payments).where(and4(
      eq5(payments.provider, "mercadopago"),
      eq5(payments.providerPaymentId, String(remote.id)),
      eq5(payments.subscriptionId, local.id),
      eq5(payments.companyId, local.companyId)
    )).limit(1);
    if (!localPayment) return;
    const amountCents = Math.round(Number(remote.transaction_amount || 0) * 100);
    if (amountCents !== localPayment.amountCents || String(remote.currency_id || "BRL") !== "BRL") return;
    const paymentStatus = String(remote.status || "pending");
    let pixData = {};
    try {
      pixData = JSON.parse(localPayment.rawStatus || "{}");
    } catch {
    }
    await getDb().update(payments).set({
      status: paymentStatus,
      paidAt: paymentStatus === "approved" ? new Date(remote.date_approved || Date.now()) : null,
      rawStatus: JSON.stringify(pixData),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq5(payments.id, localPayment.id));
    if (paymentStatus === "approved" && local.status !== "cancelled" && local.status !== "failed") {
      const now = /* @__PURE__ */ new Date();
      const previousActives = await getDb().select({
        id: subscriptions.id,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        provider: subscriptions.provider,
        providerSubscriptionId: subscriptions.providerSubscriptionId
      }).from(subscriptions).where(and4(
        eq5(subscriptions.companyId, local.companyId),
        inArray2(subscriptions.status, ["active", "trialing"]),
        lt(subscriptions.createdAt, local.createdAt)
      )).orderBy(desc3(subscriptions.createdAt));
      const futurePeriodEnds = previousActives.map((item) => item.currentPeriodEnd).filter((end) => Boolean(end && end > now)).sort((a, b) => b.getTime() - a.getTime());
      const periodStart = futurePeriodEnds[0] ?? now;
      for (const previous of previousActives) {
        if (previous.provider === "mercadopago" && previous.providerSubscriptionId) {
          await cancelMercadoPagoSubscription(previous.id);
        }
      }
      const periodEnd = new Date(periodStart);
      if (local.billingInterval === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      await getDb().update(subscriptions).set({
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        updatedAt: now
      }).where(eq5(subscriptions.id, local.id));
      await getDb().update(subscriptions).set({
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now
      }).where(and4(
        eq5(subscriptions.companyId, local.companyId),
        inArray2(subscriptions.status, ["active", "trialing"]),
        lt(subscriptions.createdAt, local.createdAt)
      ));
    }
    return;
  }
  if (type === "subscription_preapproval") {
    const remote = await mpRequest(`/preapproval/${encodeURIComponent(dataId)}`);
    const localId = String(remote.external_reference || "");
    if (!localId) return;
    const statusMap = {
      authorized: "pending",
      pending: "pending",
      paused: "past_due",
      cancelled: "cancelled"
    };
    const status = statusMap[String(remote.status)] || "pending";
    const [local] = await getDb().select().from(subscriptions).where(eq5(subscriptions.id, localId)).limit(1);
    if (!local) return;
    await getDb().update(subscriptions).set({
      provider: "mercadopago",
      providerSubscriptionId: String(remote.id),
      status: status === "pending" && local.status === "active" ? "active" : status,
      cancelledAt: status === "cancelled" ? /* @__PURE__ */ new Date() : null,
      currentPeriodStart: local.currentPeriodStart,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq5(subscriptions.id, local.id));
    return;
  }
  if (type === "subscription_authorized_payment") {
    const invoice = await mpRequest(`/authorized_payments/${encodeURIComponent(dataId)}`);
    const remoteSubscriptionId = String(invoice.preapproval_id || invoice.subscription_id || "");
    if (!remoteSubscriptionId) return;
    const [local] = await getDb().select().from(subscriptions).where(eq5(subscriptions.providerSubscriptionId, remoteSubscriptionId)).limit(1);
    if (!local) return;
    const amountCents = Math.round(Number(invoice.transaction_amount || 0) * 100);
    const rawStatus = String(invoice.payment?.status || invoice.summarized || invoice.status || "pending");
    const paymentStatus = rawStatus;
    await getDb().insert(payments).values({
      subscriptionId: local.id,
      companyId: local.companyId,
      provider: "mercadopago",
      providerPaymentId: String(invoice.payment?.id || invoice.id),
      amountCents,
      currency: String(invoice.currency_id || "BRL"),
      status: paymentStatus,
      paidAt: paymentStatus === "approved" ? new Date(invoice.date_created || Date.now()) : null,
      rawStatus
    }).onConflictDoUpdate({
      target: [payments.provider, payments.providerPaymentId],
      set: { amountCents, status: paymentStatus, paidAt: paymentStatus === "approved" ? new Date(invoice.date_created || Date.now()) : null, rawStatus, updatedAt: /* @__PURE__ */ new Date() }
    });
    if (paymentStatus === "approved" && local.status !== "cancelled") {
      const periodStart = local.currentPeriodStart || new Date(invoice.date_created || Date.now());
      const periodEnd = new Date(periodStart);
      if (local.billingInterval === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      await getDb().update(subscriptions).set({
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(subscriptions.id, local.id));
      await getDb().update(subscriptions).set({
        status: "cancelled",
        cancelledAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(and4(
        eq5(subscriptions.companyId, local.companyId),
        inArray2(subscriptions.status, ["active", "trialing"]),
        lt(subscriptions.createdAt, local.createdAt)
      ));
    }
  }
}

// server/adminUsersRouter.ts
var adminUsersRouter = router({
  list: superadminProcedure.input(z.object({
    query: z.string().trim().max(160).optional(),
    page: z.number().int().min(1).max(1e5).default(1),
    pageSize: z.number().int().min(1).max(50).default(25)
  })).query(async ({ input }) => {
    const db = getDb();
    const search = input.query?.trim();
    const where = search ? or2(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)) : void 0;
    const [rows, totalRows] = await Promise.all([
      db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        suspendedAt: users.suspendedAt,
        suspensionReason: users.suspensionReason,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
        companyName: sql`(select c.legal_name from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
        companyCnpj: sql`(select c.cnpj from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
        companyState: sql`(select c.state from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
        companyMunicipality: sql`(select c.municipality from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
        companySegment: sql`(select c.primary_segment from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
        profile_segments: sql`(select cp.segments from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_products: sql`(select cp.products from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_services: sql`(select cp.services from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_keywords: sql`(select cp.keywords from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_served_states: sql`(select cp.served_states from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_served_municipalities: sql`(select cp.served_municipalities from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_minimum_value: sql`(select cp.minimum_value from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_maximum_value: sql`(select cp.maximum_value from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_catmat_codes: sql`(select cp.catmat_codes from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_catser_codes: sql`(select cp.catser_codes from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        profile_notification_preferences: sql`(select cp.notification_preferences from company_profiles cp where cp.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) limit 1)`,
        companyId: sql`(select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
        planName: sql`(select p.name from subscriptions s inner join plans p on p.id = s.plan_id where s.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) order by s.created_at desc limit 1)`,
        subscriptionStatus: sql`(select s.status from subscriptions s where s.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) order by s.created_at desc limit 1)`
      }).from(users).where(where).orderBy(desc4(users.createdAt), desc4(users.id)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(users).where(where)
    ]);
    return {
      items: rows,
      total: totalRows[0]?.total ?? 0,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.ceil((totalRows[0]?.total ?? 0) / input.pageSize)
    };
  }),
  updateCustomer: superadminProcedure.input(z.object({
    userId: z.string().uuid(),
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    companyName: z.string().trim().min(2).max(240).optional(),
    cnpj: z.string().trim().max(18).optional().or(z.literal("")),
    state: z.string().trim().length(2).optional().or(z.literal("")),
    municipality: z.string().trim().max(160).optional().or(z.literal("")),
    primarySegment: z.string().trim().max(200).optional().or(z.literal("")),
    segments: z.array(z.string().trim().max(160)).max(100).optional(),
    products: z.array(z.string().trim().max(200)).max(200).optional(),
    services: z.array(z.string().trim().max(200)).max(200).optional(),
    keywords: z.array(z.string().trim().max(120)).max(200).optional(),
    servedStates: z.array(z.string().trim().length(2)).max(27).optional(),
    servedMunicipalities: z.array(z.string().trim().max(160)).max(500).optional(),
    catmatCodes: z.array(z.string().trim().max(40)).max(500).optional(),
    catserCodes: z.array(z.string().trim().max(40)).max(500).optional(),
    minimumValue: z.number().nonnegative().nullable().optional(),
    maximumValue: z.number().nonnegative().nullable().optional(),
    notificationPreferences: z.record(z.string(), z.unknown()).optional()
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [target] = await tx.select({
        id: users.id,
        role: users.role,
        name: users.name,
        email: users.email,
        phone: users.phone
      }).from(users).where(eq6(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError2({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado." });
      if (target.role !== "user") throw new TRPCError2({ code: "FORBIDDEN", message: "Somente contas de clientes podem ser editadas por esta fun\xE7\xE3o." });
      const [duplicateEmail] = await tx.select({ id: users.id }).from(users).where(eq6(users.email, input.email)).limit(1);
      if (duplicateEmail && duplicateEmail.id !== target.id) {
        throw new TRPCError2({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado em outra conta." });
      }
      const [membership] = await tx.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq6(companyMembers.userId, target.id)).orderBy(companyMembers.createdAt).limit(1);
      if (input.cnpj && membership) {
        const [duplicateCnpj] = await tx.select({ id: companies.id }).from(companies).where(eq6(companies.cnpj, input.cnpj)).limit(1);
        if (duplicateCnpj && duplicateCnpj.id !== membership.companyId) {
          throw new TRPCError2({ code: "CONFLICT", message: "Este CNPJ j\xE1 est\xE1 vinculado a outra empresa." });
        }
      }
      await tx.update(users).set({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        emailVerifiedAt: target.email.toLowerCase() === input.email ? void 0 : null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq6(users.id, target.id));
      if (membership) {
        await tx.update(companies).set({
          ...input.companyName !== void 0 ? { legalName: input.companyName } : {},
          ...input.cnpj !== void 0 ? { cnpj: input.cnpj || null } : {},
          ...input.state !== void 0 ? { state: input.state || null } : {},
          ...input.municipality !== void 0 ? { municipality: input.municipality || null } : {},
          ...input.primarySegment !== void 0 ? { primarySegment: input.primarySegment || null } : {},
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(companies.id, membership.companyId));
      }
      if (membership && (input.segments !== void 0 || input.products !== void 0 || input.services !== void 0 || input.keywords !== void 0 || input.servedStates !== void 0 || input.servedMunicipalities !== void 0 || input.catmatCodes !== void 0 || input.catserCodes !== void 0 || input.minimumValue !== void 0 || input.maximumValue !== void 0 || input.notificationPreferences !== void 0)) {
        await tx.insert(companyProfiles).values({
          companyId: membership.companyId,
          segments: input.segments ?? [],
          products: input.products ?? [],
          services: input.services ?? [],
          keywords: input.keywords ?? [],
          servedStates: input.servedStates ?? [],
          servedMunicipalities: input.servedMunicipalities ?? [],
          catmatCodes: input.catmatCodes ?? [],
          catserCodes: input.catserCodes ?? [],
          minimumValue: input.minimumValue == null ? null : String(input.minimumValue),
          maximumValue: input.maximumValue == null ? null : String(input.maximumValue),
          notificationPreferences: input.notificationPreferences ?? {},
          updatedAt: /* @__PURE__ */ new Date()
        }).onConflictDoUpdate({
          target: companyProfiles.companyId,
          set: {
            ...input.segments !== void 0 ? { segments: input.segments } : {},
            ...input.products !== void 0 ? { products: input.products } : {},
            ...input.services !== void 0 ? { services: input.services } : {},
            ...input.keywords !== void 0 ? { keywords: input.keywords } : {},
            ...input.servedStates !== void 0 ? { servedStates: input.servedStates } : {},
            ...input.servedMunicipalities !== void 0 ? { servedMunicipalities: input.servedMunicipalities } : {},
            ...input.catmatCodes !== void 0 ? { catmatCodes: input.catmatCodes } : {},
            ...input.catserCodes !== void 0 ? { catserCodes: input.catserCodes } : {},
            ...input.minimumValue !== void 0 ? { minimumValue: input.minimumValue == null ? null : String(input.minimumValue) } : {},
            ...input.maximumValue !== void 0 ? { maximumValue: input.maximumValue == null ? null : String(input.maximumValue) } : {},
            ...input.notificationPreferences !== void 0 ? { notificationPreferences: input.notificationPreferences } : {},
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
      }
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        companyId: membership?.companyId ?? null,
        action: "user.customer_data.admin_updated",
        entityType: "user",
        entityId: target.id,
        details: {
          targetEmailBefore: target.email,
          targetEmailAfter: input.email,
          changedFields: Object.keys(input).filter((key) => key !== "userId"),
          emailVerificationReset: target.email.toLowerCase() !== input.email
        }
      });
      return { updated: true, email: input.email, emailVerificationReset: target.email.toLowerCase() !== input.email };
    });
  }),
  plans: superadminProcedure.query(async () => {
    return getDb().select({
      id: plans.id,
      code: plans.code,
      name: plans.name,
      monthlyPriceCents: plans.monthlyPriceCents
    }).from(plans).where(and5(eq6(plans.active, true), inArray3(plans.code, ["essencial", "profissional"])));
  }),
  updatePlan: superadminProcedure.input(z.object({ userId: z.string().uuid(), planId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [target] = await tx.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq6(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError2({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado." });
      if (target.role === "superadmin") throw new TRPCError2({ code: "FORBIDDEN", message: "N\xE3o \xE9 permitido alterar o plano de uma conta superadmin." });
      const [membership] = await tx.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq6(companyMembers.userId, input.userId)).orderBy(companyMembers.createdAt).limit(1);
      if (!membership) throw new TRPCError2({ code: "NOT_FOUND", message: "Este usu\xE1rio n\xE3o possui empresa vinculada." });
      const [plan] = await tx.select({ id: plans.id, code: plans.code, name: plans.name }).from(plans).where(and5(eq6(plans.id, input.planId), eq6(plans.active, true), inArray3(plans.code, ["essencial", "profissional"]))).limit(1);
      if (!plan) throw new TRPCError2({ code: "BAD_REQUEST", message: "Plano indispon\xEDvel ou n\xE3o reconhecido." });
      const [current] = await tx.select({
        id: subscriptions.id,
        planId: subscriptions.planId,
        providerSubscriptionId: subscriptions.providerSubscriptionId
      }).from(subscriptions).where(eq6(subscriptions.companyId, membership.companyId)).orderBy(desc4(subscriptions.createdAt)).limit(1);
      if (current?.providerSubscriptionId) {
        throw new TRPCError2({ code: "CONFLICT", message: "Esta assinatura est\xE1 vinculada ao Mercado Pago. Altere o plano no provedor de cobran\xE7a antes de atualizar o cadastro, para evitar diverg\xEAncia de valores." });
      }
      if (current) {
        await tx.update(subscriptions).set({
          planId: plan.id,
          status: "active",
          billingInterval: "monthly",
          cancelledAt: null,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(subscriptions.id, current.id));
      } else {
        await tx.insert(subscriptions).values({
          companyId: membership.companyId,
          planId: plan.id,
          status: "active",
          billingInterval: "monthly"
        });
      }
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        companyId: membership.companyId,
        action: "subscription.plan.admin_updated",
        entityType: "subscription",
        entityId: current?.id ?? membership.companyId,
        details: {
          targetEmail: target.email,
          previousPlanId: current?.planId ?? null,
          newPlanId: plan.id,
          newPlanCode: plan.code,
          newPlanName: plan.name,
          manuallyAssigned: true
        }
      });
      return { updated: true, planName: plan.name };
    });
  }),
  updateRole: superadminProcedure.input(z.object({
    userId: z.string().uuid(),
    role: z.enum(["user", "admin", "source_operator", "support", "finance"])
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [target] = await tx.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq6(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError2({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado." });
      if (target.role === "superadmin") {
        throw new TRPCError2({ code: "FORBIDDEN", message: "A altera\xE7\xE3o de superadministradores exige procedimento de seguran\xE7a separado." });
      }
      if (target.role === input.role) return { updated: false, role: target.role };
      await tx.update(users).set({ role: input.role, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(users.id, input.userId));
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        action: "user.role.updated",
        entityType: "user",
        entityId: input.userId,
        details: { previousRole: target.role, newRole: input.role, targetEmail: target.email }
      });
      return { updated: true, role: input.role };
    });
  }),
  deleteAccount: superadminProcedure.input(z.object({ userId: z.string().uuid(), confirmationEmail: z.string().trim().email().max(320) })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [target] = await db.select({ id: users.id, role: users.role, email: users.email, name: users.name }).from(users).where(eq6(users.id, input.userId)).limit(1);
    if (!target) throw new TRPCError2({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado." });
    if (target.role !== "user") {
      throw new TRPCError2({ code: "FORBIDDEN", message: "A exclus\xE3o pelo painel est\xE1 dispon\xEDvel somente para contas de clientes." });
    }
    if (target.email.toLowerCase() !== input.confirmationEmail.toLowerCase()) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "O e-mail de confirma\xE7\xE3o n\xE3o corresponde \xE0 conta selecionada." });
    }
    const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq6(companyMembers.userId, target.id)).orderBy(companyMembers.createdAt).limit(1);
    const companyId = membership?.companyId ?? null;
    if (companyId) {
      const companySubscriptions = await db.select({
        id: subscriptions.id,
        provider: subscriptions.provider,
        providerSubscriptionId: subscriptions.providerSubscriptionId,
        status: subscriptions.status
      }).from(subscriptions).where(eq6(subscriptions.companyId, companyId));
      for (const subscription of companySubscriptions) {
        if (subscription.provider === "mercadopago" && subscription.providerSubscriptionId && subscription.status !== "cancelled") {
          await cancelMercadoPagoSubscription(subscription.id).catch((error) => {
            throw new TRPCError2({
              code: "PRECONDITION_FAILED",
              message: "N\xE3o foi poss\xEDvel cancelar a assinatura vinculada ao Mercado Pago. A conta foi mantida. Regularize a assinatura no provedor e tente novamente.",
              cause: error
            });
          });
        }
      }
    }
    await db.transaction(async (tx) => {
      const [lockedTarget] = await tx.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq6(users.id, input.userId)).limit(1);
      if (!lockedTarget || lockedTarget.role !== "user" || lockedTarget.email.toLowerCase() !== input.confirmationEmail.toLowerCase()) {
        throw new TRPCError2({ code: "CONFLICT", message: "A conta mudou durante a opera\xE7\xE3o. Atualize a lista e tente novamente." });
      }
      let removedCompany = false;
      if (companyId) {
        const members = await tx.select({ userId: companyMembers.userId }).from(companyMembers).where(eq6(companyMembers.companyId, companyId));
        removedCompany = members.every((member) => member.userId === target.id);
      }
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        companyId,
        action: "user.account.deleted",
        entityType: "user",
        entityId: target.id,
        details: {
          targetEmail: target.email,
          targetName: target.name,
          companyRemoved: removedCompany,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      if (companyId && removedCompany) {
        await tx.delete(companies).where(eq6(companies.id, companyId));
      }
      await tx.delete(users).where(eq6(users.id, target.id));
    });
    return { deleted: true, email: target.email };
  }),
  setSuspension: superadminProcedure.input(z.object({
    userId: z.string().uuid(),
    suspended: z.boolean(),
    reason: z.string().trim().max(500).optional()
  }).superRefine((value, ctx) => {
    if (value.suspended && !value.reason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Informe o motivo da suspens\xE3o." });
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [target] = await tx.select({
        id: users.id,
        role: users.role,
        email: users.email,
        suspendedAt: users.suspendedAt,
        suspensionReason: users.suspensionReason
      }).from(users).where(eq6(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError2({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado." });
      if (target.role !== "user") throw new TRPCError2({ code: "FORBIDDEN", message: "Somente contas de clientes podem ser suspensas por esta tela." });
      if (input.suspended && target.suspendedAt) return { updated: false, suspended: true, revokedCount: 0 };
      if (!input.suspended && !target.suspendedAt) return { updated: false, suspended: false, revokedCount: 0 };
      const now = /* @__PURE__ */ new Date();
      await tx.update(users).set({
        suspendedAt: input.suspended ? now : null,
        suspensionReason: input.suspended ? input.reason.trim() : null,
        updatedAt: now
      }).where(eq6(users.id, input.userId));
      const revoked = input.suspended ? await tx.delete(authSessions).where(eq6(authSessions.userId, input.userId)).returning({ tokenHash: authSessions.tokenHash }) : [];
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        action: input.suspended ? "user.account.suspended" : "user.account.reactivated",
        entityType: "user",
        entityId: input.userId,
        details: { targetEmail: target.email, reason: input.suspended ? input.reason.trim() : target.suspensionReason, revokedSessionCount: revoked.length }
      });
      return { updated: true, suspended: input.suspended, revokedCount: revoked.length };
    });
  }),
  revokeSessions: superadminProcedure.input(z.object({ userId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [target] = await tx.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq6(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError2({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado." });
      if (target.role === "superadmin") {
        throw new TRPCError2({ code: "FORBIDDEN", message: "O encerramento de sess\xF5es de superadministrador exige procedimento separado." });
      }
      const revoked = await tx.delete(authSessions).where(eq6(authSessions.userId, input.userId)).returning({ tokenHash: authSessions.tokenHash });
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        action: "user.sessions.revoked",
        entityType: "user",
        entityId: input.userId,
        details: { targetEmail: target.email, revokedSessionCount: revoked.length }
      });
      return { revokedCount: revoked.length };
    });
  }),
  audit: superadminProcedure.input(z.object({
    query: z.string().trim().max(120).optional(),
    page: z.number().int().min(1).max(1e5).default(1),
    pageSize: z.number().int().min(1).max(50).default(25)
  })).query(async ({ input }) => {
    const db = getDb();
    const search = input.query?.trim();
    const where = search ? or2(
      ilike(auditLogs.action, `%${search}%`),
      ilike(auditLogs.entityType, `%${search}%`),
      ilike(auditLogs.entityId, `%${search}%`)
    ) : void 0;
    const [items, totalRows] = await Promise.all([
      db.select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        actorName: users.name,
        actorEmail: users.email,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt
      }).from(auditLogs).leftJoin(users, sql`${users.id} = ${auditLogs.actorUserId}`).where(where).orderBy(desc4(auditLogs.createdAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(auditLogs).where(where)
    ]);
    return {
      items,
      total: totalRows[0]?.total ?? 0,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.ceil((totalRows[0]?.total ?? 0) / input.pageSize)
    };
  })
});

// server/supportRouter.ts
import { and as and6, desc as desc5, eq as eq7, inArray as inArray4 } from "drizzle-orm";
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
var ticketStatus = z2.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]);
var ticketPriority = z2.enum(["normal", "high"]);
var messageBody = z2.string().trim().min(1).max(8e3);
async function getOwnedTicket(ticketId, userId) {
  const [ticket] = await getDb().select().from(supportTickets).where(and6(eq7(supportTickets.id, ticketId), eq7(supportTickets.userId, userId))).limit(1);
  if (!ticket) throw new TRPCError3({ code: "NOT_FOUND", message: "Atendimento n\xE3o encontrado." });
  return ticket;
}
var supportRouter = router({
  myTickets: authenticatedProcedure.query(async ({ ctx }) => {
    return getDb().select().from(supportTickets).where(eq7(supportTickets.userId, ctx.user.id)).orderBy(desc5(supportTickets.lastMessageAt)).limit(100);
  }),
  create: authenticatedProcedure.input(z2.object({
    subject: z2.string().trim().min(4).max(160),
    category: z2.enum(["general", "billing", "technical", "opportunity", "account"]).default("general"),
    message: messageBody
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [membership] = await tx.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq7(companyMembers.userId, ctx.user.id)).orderBy(companyMembers.createdAt).limit(1);
      const [plan] = membership ? await tx.select({ code: plans.code }).from(subscriptions).innerJoin(plans, eq7(subscriptions.planId, plans.id)).where(and6(eq7(subscriptions.companyId, membership.companyId), eq7(subscriptions.status, "active"))).orderBy(desc5(subscriptions.createdAt)).limit(1) : [];
      const priority = plan?.code === "profissional" ? "high" : "normal";
      const [ticket] = await tx.insert(supportTickets).values({
        userId: ctx.user.id,
        companyId: membership?.companyId ?? null,
        subject: input.subject,
        category: input.category,
        priority,
        status: "open",
        lastMessageAt: /* @__PURE__ */ new Date()
      }).returning();
      await tx.insert(supportMessages).values({ ticketId: ticket.id, senderUserId: ctx.user.id, body: input.message });
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        companyId: membership?.companyId ?? null,
        action: "support.ticket.created",
        entityType: "support_ticket",
        entityId: ticket.id,
        details: { category: input.category, priority }
      });
      return ticket;
    });
  }),
  messages: authenticatedProcedure.input(z2.object({ ticketId: z2.string().uuid() })).query(async ({ input, ctx }) => {
    const ticket = await getOwnedTicket(input.ticketId, ctx.user.id);
    return getDb().select().from(supportMessages).where(and6(eq7(supportMessages.ticketId, ticket.id), eq7(supportMessages.isInternal, false))).orderBy(supportMessages.createdAt);
  }),
  reply: authenticatedProcedure.input(z2.object({ ticketId: z2.string().uuid(), message: messageBody })).mutation(async ({ input, ctx }) => {
    const ticket = await getOwnedTicket(input.ticketId, ctx.user.id);
    if (["resolved", "closed"].includes(ticket.status)) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Este atendimento foi encerrado. Reabra um novo chamado para continuar." });
    }
    const db = getDb();
    return db.transaction(async (tx) => {
      const [message] = await tx.insert(supportMessages).values({
        ticketId: ticket.id,
        senderUserId: ctx.user.id,
        body: input.message
      }).returning();
      await tx.update(supportTickets).set({
        status: "open",
        lastMessageAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq7(supportTickets.id, ticket.id));
      return message;
    });
  }),
  adminQueue: superadminProcedure.input(z2.object({
    status: ticketStatus.optional(),
    priority: ticketPriority.optional(),
    query: z2.string().trim().max(160).optional()
  }).optional()).query(async ({ input }) => {
    const filters = [];
    if (input?.status) filters.push(eq7(supportTickets.status, input.status));
    if (input?.priority) filters.push(eq7(supportTickets.priority, input.priority));
    const rows = await getDb().select({
      ticket: supportTickets,
      customerName: users.name,
      customerEmail: users.email
    }).from(supportTickets).innerJoin(users, eq7(supportTickets.userId, users.id)).where(filters.length ? and6(...filters) : void 0).orderBy(desc5(supportTickets.lastMessageAt)).limit(200);
    const assignedIds = [...new Set(rows.map((row) => row.ticket.assignedToUserId).filter((id) => Boolean(id)))];
    const assignees = assignedIds.length ? await getDb().select({ id: users.id, name: users.name }).from(users).where(inArray4(users.id, assignedIds)) : [];
    const names = new Map(assignees.map((item) => [item.id, item.name]));
    const query = input?.query?.toLowerCase();
    return rows.filter((row) => !query || row.customerName.toLowerCase().includes(query) || row.customerEmail.toLowerCase().includes(query) || row.ticket.subject.toLowerCase().includes(query)).map((row) => ({ ...row.ticket, customerName: row.customerName, customerEmail: row.customerEmail, assignedName: row.ticket.assignedToUserId ? names.get(row.ticket.assignedToUserId) ?? null : null })).sort((a, b) => a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1);
  }),
  adminMessages: superadminProcedure.input(z2.object({ ticketId: z2.string().uuid() })).query(async ({ input }) => {
    return getDb().select({
      id: supportMessages.id,
      ticketId: supportMessages.ticketId,
      senderUserId: supportMessages.senderUserId,
      body: supportMessages.body,
      isInternal: supportMessages.isInternal,
      createdAt: supportMessages.createdAt,
      senderName: users.name,
      senderEmail: users.email
    }).from(supportMessages).leftJoin(users, eq7(supportMessages.senderUserId, users.id)).where(eq7(supportMessages.ticketId, input.ticketId)).orderBy(supportMessages.createdAt);
  }),
  adminReply: superadminProcedure.input(z2.object({
    ticketId: z2.string().uuid(),
    message: messageBody,
    internal: z2.boolean().default(false)
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [ticket] = await db.select().from(supportTickets).where(eq7(supportTickets.id, input.ticketId)).limit(1);
    if (!ticket) throw new TRPCError3({ code: "NOT_FOUND", message: "Atendimento n\xE3o encontrado." });
    return db.transaction(async (tx) => {
      const [message] = await tx.insert(supportMessages).values({
        ticketId: ticket.id,
        senderUserId: ctx.user.id,
        body: input.message,
        isInternal: input.internal
      }).returning();
      if (!input.internal) await tx.update(supportTickets).set({
        status: "waiting_customer",
        lastMessageAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq7(supportTickets.id, ticket.id));
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        companyId: ticket.companyId,
        action: input.internal ? "support.note.created" : "support.reply.sent",
        entityType: "support_ticket",
        entityId: ticket.id,
        details: { internal: input.internal }
      });
      return message;
    });
  }),
  adminUpdate: superadminProcedure.input(z2.object({
    ticketId: z2.string().uuid(),
    status: ticketStatus.optional(),
    priority: ticketPriority.optional(),
    assignedToUserId: z2.string().uuid().nullable().optional()
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [ticket] = await db.select().from(supportTickets).where(eq7(supportTickets.id, input.ticketId)).limit(1);
    if (!ticket) throw new TRPCError3({ code: "NOT_FOUND", message: "Atendimento n\xE3o encontrado." });
    if (input.assignedToUserId) {
      const [assignee] = await db.select({ id: users.id, role: users.role }).from(users).where(eq7(users.id, input.assignedToUserId)).limit(1);
      if (!assignee || !["superadmin", "admin", "support"].includes(assignee.role)) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Respons\xE1vel deve ser um usu\xE1rio da equipe administrativa ou de suporte." });
      }
    }
    const patch = { updatedAt: /* @__PURE__ */ new Date() };
    if (input.status) {
      patch.status = input.status;
      patch.closedAt = ["resolved", "closed"].includes(input.status) ? /* @__PURE__ */ new Date() : null;
    }
    if (input.priority) patch.priority = input.priority;
    if (input.assignedToUserId !== void 0) patch.assignedToUserId = input.assignedToUserId;
    const [updated] = await db.update(supportTickets).set(patch).where(eq7(supportTickets.id, ticket.id)).returning();
    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id,
      companyId: ticket.companyId,
      action: "support.ticket.updated",
      entityType: "support_ticket",
      entityId: ticket.id,
      details: { status: input.status ?? ticket.status, priority: input.priority ?? ticket.priority, assignedToUserId: input.assignedToUserId === void 0 ? ticket.assignedToUserId : input.assignedToUserId }
    });
    return updated;
  })
});

// server/orbeAiRouter.ts
import { and as and10, asc as asc3, count as count4, desc as desc8, eq as eq11, gte as gte2, inArray as inArray8, isNull as isNull2, or as or6 } from "drizzle-orm";
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";

// server/services/planLimits.ts
import { and as and7, count as count2, desc as desc6, eq as eq8, inArray as inArray5, or as or3, sql as sql2 } from "drizzle-orm";
function currentPeriodStart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(/* @__PURE__ */ new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}-01`;
}
async function getCompanyId(userId) {
  const [membership] = await getDb().select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq8(companyMembers.userId, userId)).limit(1);
  return membership?.companyId ?? null;
}
async function getActivePlan(companyId) {
  const [row] = await getDb().select({
    subscriptionId: subscriptions.id,
    planId: plans.id,
    code: plans.code,
    name: plans.name,
    description: plans.description,
    monthlyPriceCents: plans.monthlyPriceCents,
    limits: plans.limits,
    features: plans.features,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    status: subscriptions.status,
    provider: subscriptions.provider,
    providerSubscriptionId: subscriptions.providerSubscriptionId
  }).from(subscriptions).innerJoin(plans, eq8(subscriptions.planId, plans.id)).leftJoin(payments, eq8(payments.subscriptionId, subscriptions.id)).where(and7(eq8(subscriptions.companyId, companyId), eq8(subscriptions.status, "active"), eq8(plans.active, true), or3(eq8(payments.status, "approved"), and7(eq8(plans.monthlyPriceCents, 0), eq8(subscriptions.provider, "orbeedital"))))).orderBy(desc6(subscriptions.createdAt)).limit(1);
  return row ?? null;
}
async function getCompanyCounts(companyId, userIds) {
  const db = getDb();
  const [favoriteRows, savedRows] = await Promise.all([
    db.select({ total: count2() }).from(favorites).innerJoin(companyMembers, eq8(favorites.userId, companyMembers.userId)).where(eq8(companyMembers.companyId, companyId)),
    db.select({ total: count2() }).from(savedSearches).where(or3(eq8(savedSearches.companyId, companyId), inArray5(savedSearches.userId, userIds)))
  ]);
  return {
    favorites: Number(favoriteRows[0]?.total ?? 0),
    savedSearches: Number(savedRows[0]?.total ?? 0)
  };
}
async function getPlanUsageSummary(userId) {
  const db = getDb();
  const companyId = await getCompanyId(userId);
  if (!companyId) {
    return { hasSubscription: false, plan: null, limits: null, usage: { searchesThisMonth: 0, favorites: 0, savedSearches: 0 }, periodStart: currentPeriodStart() };
  }
  const [plan, members, monthlyRows] = await Promise.all([
    getActivePlan(companyId),
    db.select({ userId: companyMembers.userId }).from(companyMembers).where(eq8(companyMembers.companyId, companyId)),
    db.select({ searchesCount: planUsage.searchesCount }).from(planUsage).where(and7(eq8(planUsage.companyId, companyId), eq8(planUsage.periodStart, currentPeriodStart()))).limit(1)
  ]);
  const userIds = members.map((member) => member.userId);
  const counts = await getCompanyCounts(companyId, userIds);
  return {
    hasSubscription: Boolean(plan),
    plan: plan ? {
      id: plan.planId,
      code: plan.code,
      name: plan.name,
      monthlyPriceCents: plan.monthlyPriceCents,
      currentPeriodEnd: plan.currentPeriodEnd,
      status: plan.status,
      canChangePlan: plan.provider === "mercadopago" && Boolean(plan.providerSubscriptionId)
    } : null,
    limits: plan?.limits ?? null,
    usage: {
      searchesThisMonth: Number(monthlyRows[0]?.searchesCount ?? 0),
      favorites: counts.favorites,
      savedSearches: counts.savedSearches
    },
    periodStart: currentPeriodStart()
  };
}
async function assertWithinLimit(userId, limitKey, usageKey) {
  const summary = await getPlanUsageSummary(userId);
  if (!summary.hasSubscription || !summary.limits) {
    throw new Error("Sua empresa ainda n\xE3o possui uma assinatura ativa. Escolha um plano para continuar.");
  }
  const limit = Number(summary.limits[limitKey] ?? 0);
  const used = Number(summary.usage[usageKey] ?? 0);
  if (limit > 0 && used >= limit) {
    const messages = {
      maxSearchesPerMonth: "Voc\xEA atingiu o limite mensal de pesquisas do seu plano. Fa\xE7a upgrade para continuar.",
      maxFavorites: "Voc\xEA atingiu o limite de oportunidades favoritas do seu plano. Remova um favorito ou fa\xE7a upgrade.",
      maxSavedSearches: "Voc\xEA atingiu o limite de pesquisas salvas do seu plano. Exclua uma pesquisa ou fa\xE7a upgrade."
    };
    throw new Error(messages[limitKey]);
  }
}
async function recordSearchUsage(userId) {
  const db = getDb();
  const companyId = await getCompanyId(userId);
  if (!companyId) throw new Error("Sua empresa ainda n\xE3o possui uma assinatura ativa. Escolha um plano para continuar.");
  const plan = await getActivePlan(companyId);
  if (!plan) throw new Error("Sua empresa ainda n\xE3o possui uma assinatura ativa. Escolha um plano para continuar.");
  const limit = Number(plan.limits.maxSearchesPerMonth ?? 0);
  const periodStart = currentPeriodStart();
  const result = await db.execute(sql2`
    INSERT INTO public.plan_usage (company_id, period_start, searches_count, updated_at)
    VALUES (${companyId}::uuid, ${periodStart}::date, 1, now())
    ON CONFLICT (company_id, period_start)
    DO UPDATE SET searches_count = public.plan_usage.searches_count + 1, updated_at = now()
    WHERE ${limit} <= 0 OR public.plan_usage.searches_count < ${limit}
    RETURNING searches_count
  `);
  const rows = result.rows;
  if (!rows.length) {
    throw new Error("Voc\xEA atingiu o limite mensal de pesquisas do seu plano. Fa\xE7a upgrade para continuar.");
  }
  return Number(rows[0].searches_count);
}
async function ensureCanAddFavorite(userId) {
  await assertWithinLimit(userId, "maxFavorites", "favorites");
}
async function ensureCanSaveSearch(userId) {
  await assertWithinLimit(userId, "maxSavedSearches", "savedSearches");
}

// server/services/opportunities.ts
import { and as and9, asc as asc2, count as count3, desc as desc7, eq as eq10, gte, ilike as ilike2, inArray as inArray7, isNull, lt as lt2, lte, or as or5, sql as sql4, sum } from "drizzle-orm";

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

// server/services/pncpItemIndex.ts
import { and as and8, asc, eq as eq9, gt as gt3, inArray as inArray6, or as or4, sql as sql3 } from "drizzle-orm";

// server/services/opportunityItemHistory.ts
var ITEM_FIELDS = [
  "description",
  "catalogCode",
  "catalogSystem",
  "quantity",
  "unit",
  "estimatedUnitValue",
  "estimatedTotalValue",
  "specifications"
];
function itemKey(item) {
  return item.itemNumber?.trim() || item.sourceItemKey?.trim() || `${item.catalogCode ?? ""}:${item.description.trim()}`;
}
function compareOpportunityItems(previous, next) {
  const oldByKey = new Map(previous.map((item) => [itemKey(item), item]));
  const newByKey = new Map(next.map((item) => [itemKey(item), item]));
  const altered = [];
  const added = [];
  const removed = [];
  for (const [key, current] of newByKey) {
    const old = oldByKey.get(key);
    if (!old) {
      added.push(current);
      continue;
    }
    const changes = {};
    for (const field of ITEM_FIELDS) {
      if ((old[field] ?? null) !== (current[field] ?? null)) {
        changes[field] = { previous: old[field] ?? null, next: current[field] ?? null };
      }
    }
    if (Object.keys(changes).length) {
      altered.push({ itemNumber: current.itemNumber, description: current.description, changes });
    }
  }
  for (const [key, old] of oldByKey) {
    if (!newByKey.has(key)) removed.push(old);
  }
  return { altered, added, removed };
}
function summarizeOpportunityItemChanges(changes) {
  const parts = [
    changes.altered.length ? `${changes.altered.length} alterado(s)` : "",
    changes.added.length ? `${changes.added.length} inclu\xEDdo(s)` : "",
    changes.removed.length ? `${changes.removed.length} removido(s)` : ""
  ].filter(Boolean);
  return parts.length ? `A fonte oficial atualizou itens do edital: ${parts.join(", ")}.` : null;
}

// server/services/pncpItemIndex.ts
function itemUrl(row) {
  const raw = row.rawData?.raw;
  const record = raw && typeof raw === "object" ? raw : {};
  const control = row.controlNumber ?? (typeof record.numeroControlePNCP === "string" ? record.numeroControlePNCP : null);
  const sequence = Number(record.sequencialCompra ?? control?.match(/-\d-(\d+)\/\d{4}$/)?.[1]);
  const year = Number(control?.match(/\/(\d{4})$/)?.[1] ?? record.anoCompra ?? row.year);
  const cnpj = (control?.split("-")[0] || row.agencyCnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14 || !Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) return null;
  return new URL(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${year}/${sequence}/itens`);
}
async function indexOpportunityItems(row) {
  const baseUrl = itemUrl(row);
  if (!baseUrl) return [];
  const fetched = [];
  for (let page = 1; page <= 20; page++) {
    const url = new URL(baseUrl);
    url.searchParams.set("pagina", String(page));
    url.searchParams.set("tamanhoPagina", "500");
    const response = await fetch(url, { signal: AbortSignal.timeout(8e3), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`PNCP item API returned ${response.status}`);
    const body = await response.json();
    const object = body && typeof body === "object" && !Array.isArray(body) ? body : null;
    const data = Array.isArray(body) ? body : [object?.data, object?.items, object?.resultado, object?.results].find(Array.isArray) ?? [];
    fetched.push(...data);
    const totalPages = Number(object?.totalPaginas ?? object?.totalPages);
    if (page === 20 && data.length === 500 && (!Number.isFinite(totalPages) || totalPages > 20)) {
      throw new Error("PNCP item API page count exceeds the safe indexing limit");
    }
    if (!data.length || Number.isFinite(totalPages) && totalPages > 0 && page >= totalPages || data.length < 500) break;
  }
  const mapped = fetched.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value;
    const description = [item.descricao, item.descricaoDetalhada, item.descricaoComplementar].find((entry) => typeof entry === "string" && entry.trim().length > 0)?.trim();
    if (!description) return [];
    const sourceItemKey = item.numeroItem ?? item.itemId ?? item.id ?? item.identificadorItem;
    const numeric2 = (...keys) => {
      for (const key of keys) {
        const value2 = item[key];
        if (typeof value2 === "number" && Number.isFinite(value2)) return String(value2);
        if (typeof value2 === "string" && value2.trim() && Number.isFinite(Number(value2))) return String(Number(value2));
      }
      return null;
    };
    const catalog = item.catalogo && typeof item.catalogo === "object" ? item.catalogo : null;
    return [{
      opportunityId: row.id,
      itemNumber: item.numeroItem == null ? null : String(item.numeroItem),
      description,
      catalogCode: item.codigoItem == null ? item.catalogoCodigoItem == null ? null : String(item.catalogoCodigoItem) : String(item.codigoItem),
      catalogSystem: typeof item.catalogo === "string" ? item.catalogo : typeof catalog?.nome === "string" ? catalog.nome : null,
      quantity: numeric2("quantidade"),
      unit: typeof item.unidadeMedida === "string" ? item.unidadeMedida : null,
      estimatedUnitValue: numeric2("valorUnitarioEstimado"),
      estimatedTotalValue: numeric2("valorTotal", "valorTotalEstimado"),
      specifications: [item.especificacao, item.descricaoDetalhada, item.descricaoComplementar].filter((entry) => typeof entry === "string" && entry.trim().length > 0 && entry.trim() !== description).join("\n") || null,
      sourceItemKey: sourceItemKey == null ? null : String(sourceItemKey)
    }];
  });
  const db = getDb();
  const existing = await db.select().from(opportunityItems).where(eq9(opportunityItems.opportunityId, row.id));
  const toSnapshot = (item) => ({
    sourceItemKey: item.sourceItemKey,
    itemNumber: item.itemNumber,
    description: item.description,
    catalogCode: item.catalogCode,
    catalogSystem: item.catalogSystem,
    quantity: item.quantity,
    unit: item.unit,
    estimatedUnitValue: item.estimatedUnitValue,
    estimatedTotalValue: item.estimatedTotalValue,
    specifications: item.specifications
  });
  const changes = existing.length && mapped.length ? compareOpportunityItems(existing.map(toSnapshot), mapped.map(toSnapshot)) : null;
  const summary = changes ? summarizeOpportunityItemChanges(changes) : null;
  await db.transaction(async (tx) => {
    if (mapped.length && (changes?.altered.length || changes?.added.length || changes?.removed.length)) {
      await tx.delete(opportunityItems).where(eq9(opportunityItems.opportunityId, row.id));
      for (let offset = 0; offset < mapped.length; offset += 100) await tx.insert(opportunityItems).values(mapped.slice(offset, offset + 100));
    } else if (mapped.length && !existing.length) {
      for (let offset = 0; offset < mapped.length; offset += 100) await tx.insert(opportunityItems).values(mapped.slice(offset, offset + 100));
    }
    await tx.update(opportunities).set({ itemsSyncedAt: /* @__PURE__ */ new Date() }).where(eq9(opportunities.id, row.id));
    if (summary && changes) {
      await tx.insert(opportunityHistory).values({
        opportunityId: row.id,
        eventType: "source_items_update",
        summary,
        previousValues: { items: { altered: changes.altered.map((item) => ({ itemNumber: item.itemNumber, description: item.description, fields: Object.fromEntries(Object.entries(item.changes).map(([field, values]) => [field, values.previous])) })), removed: changes.removed.map(({ itemNumber, description }) => ({ itemNumber, description })) } },
        newValues: { items: { altered: changes.altered.map((item) => ({ itemNumber: item.itemNumber, description: item.description, fields: Object.fromEntries(Object.entries(item.changes).map(([field, values]) => [field, values.next])) })), added: changes.added.map(({ itemNumber, description }) => ({ itemNumber, description })) } }
      });
    }
  });
  return db.select().from(opportunityItems).where(eq9(opportunityItems.opportunityId, row.id));
}
async function indexPncpItems(limit = 160) {
  const db = getDb();
  const [connector] = await db.select().from(connectors).where(eq9(connectors.code, "pncp")).limit(1);
  if (!connector) return { scanned: 0, indexed: 0, failures: 0 };
  const config = connector.configuration ?? {};
  const cursor = typeof config.itemsCursor === "string" ? config.itemsCursor : "";
  const staleItems = or4(
    and8(sql3`not exists (select 1 from opportunity_items oi where oi.opportunity_id = ${opportunities.id})`, sql3`${opportunities.itemsSyncedAt} is null`),
    and8(sql3`${opportunities.lastSourceUpdateAt} is not null`, or4(sql3`${opportunities.itemsSyncedAt} is null`, gt3(opportunities.lastSourceUpdateAt, opportunities.itemsSyncedAt)))
  );
  const rows = await db.select({ id: opportunities.id, agencyCnpj: opportunities.agencyCnpj, year: opportunities.year, controlNumber: opportunities.controlNumber, rawData: opportunities.rawData }).from(opportunities).where(and8(inArray6(opportunities.connectorId, db.select({ id: connectors.id }).from(connectors).where(inArray6(connectors.code, ["pncp", "compras.gov.br"]))), gt3(opportunities.id, cursor || "00000000-0000-0000-0000-000000000000"), staleItems)).orderBy(asc(opportunities.id)).limit(Math.min(Math.max(limit, 1), 180));
  let indexed = 0, failures = 0;
  for (let offset = 0; offset < rows.length; offset += 12) {
    await Promise.all(rows.slice(offset, offset + 12).map(async (row) => {
      try {
        indexed += (await indexOpportunityItems(row)).length;
      } catch {
        failures++;
      }
    }));
  }
  const itemsCursor = rows.length < Math.min(Math.max(limit, 1), 180) ? "" : rows.at(-1).id;
  await db.update(connectors).set({ configuration: sql3`jsonb_set(coalesce(${connectors.configuration}, '{}'::jsonb), '{itemsCursor}', to_jsonb(${itemsCursor}::text), true)`, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(connectors.id, connector.id));
  return { scanned: rows.length, indexed, failures };
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
    const aliases = {
      tv: ["tv", "televisor", "televisao", "televis\xE3o", "smart tv"],
      televisor: ["televisor", "tv", "televisao", "televis\xE3o"],
      televisao: ["televisao", "televis\xE3o", "televisor", "tv"],
      televisaoo: ["televis\xE3o", "televisor", "tv"],
      full: ["full", "fhd", "1920x1080", "1920 x 1080"],
      hd: ["hd", "high definition", "1080p"],
      notebook: ["notebook", "laptop", "computador portatil", "computador port\xE1til"],
      computador: ["computador", "desktop", "microcomputador", "pc"],
      celular: ["celular", "smartphone", "telefone movel", "telefone m\xF3vel"],
      impressora: ["impressora", "multifuncional"],
      legumes: ["legumes", "legume", "hortalica", "hortali\xE7a"],
      legume: ["legume", "legumes", "hortalica", "hortali\xE7a"]
    };
    const terms = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
    const normalized = terms.filter((term) => !["de", "da", "do", "das", "dos", "em", "para"].includes(term));
    for (const term of normalized) {
      if (term === "in") continue;
      const options = aliases[term] ?? [term];
      const matches = options.flatMap((option) => {
        const like = "%" + option.replace(/[%_]/g, "\\$&") + "%";
        return [
          ilike2(opportunities.title, like),
          ilike2(opportunities.description, like),
          ilike2(opportunities.agencyName, like),
          ilike2(opportunities.processNumber, like),
          ilike2(opportunities.procurementNumber, like),
          ilike2(opportunities.agencyCnpj, like),
          sql4`exists (select 1 from opportunity_items oi where oi.opportunity_id = ${opportunities.id} and (oi.description ilike ${like} or oi.specifications ilike ${like} or oi.catalog_code ilike ${like}))`
        ];
      });
      clauses.push(or5(...matches));
    }
  }
  if (filters.states?.length) clauses.push(inArray7(opportunities.state, filters.states.map((state) => state.toUpperCase())));
  if (filters.municipality?.trim()) clauses.push(ilike2(opportunities.municipality, `%${filters.municipality.trim()}%`));
  if (filters.modalities?.length) clauses.push(inArray7(opportunities.modality, filters.modalities));
  if (filters.statuses?.length) clauses.push(inArray7(opportunities.status, filters.statuses));
  if (filters.minValue !== void 0) clauses.push(gte(opportunities.estimatedValue, String(filters.minValue)));
  if (filters.maxValue !== void 0) clauses.push(lte(opportunities.estimatedValue, String(filters.maxValue)));
  if (filters.publishedFrom) clauses.push(gte(opportunities.publicationDate, new Date(filters.publishedFrom)));
  if (filters.publishedTo) clauses.push(lte(opportunities.publicationDate, new Date(filters.publishedTo)));
  if (filters.deadlineFrom) clauses.push(gte(opportunities.proposalDeadline, new Date(filters.deadlineFrom)));
  if (filters.deadlineTo) clauses.push(lte(opportunities.proposalDeadline, new Date(filters.deadlineTo)));
  if (filters.source) clauses.push(eq10(connectors.code, filters.source));
  if (filters.onlyOpen) {
    clauses.push(gte(opportunities.proposalDeadline, /* @__PURE__ */ new Date()));
    clauses.push(inArray7(opportunities.status, ["unknown", "published", "receiving_proposals", "open", "in_progress"]));
  }
  return clauses.length ? and9(...clauses) : void 0;
}
async function searchOpportunities(filters, userId) {
  const db = getDb();
  const where = buildFilters(filters);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = OPPORTUNITIES_PAGE_SIZE;
  const [totalRow] = await db.select({ total: count3() }).from(opportunities).innerJoin(connectors, eq10(opportunities.connectorId, connectors.id)).where(where);
  const rows = await db.select({ opportunity: opportunities, sourceName: connectors.name, sourceCode: connectors.code }).from(opportunities).innerJoin(connectors, eq10(opportunities.connectorId, connectors.id)).where(where).orderBy(desc7(opportunities.lastSyncedAt), desc7(opportunities.publicationDate), desc7(opportunities.createdAt), asc2(opportunities.id)).limit(pageSize).offset((page - 1) * pageSize);
  const ids = rows.map((row) => row.opportunity.id);
  const saved = ids.length ? await db.select({ id: favorites.opportunityId }).from(favorites).where(and9(eq10(favorites.userId, userId), inArray7(favorites.opportunityId, ids))) : [];
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
  const rows = await db.select({ opportunity: opportunities, sourceName: connectors.name, sourceCode: connectors.code }).from(opportunities).innerJoin(connectors, eq10(opportunities.connectorId, connectors.id)).where(eq10(opportunities.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const [storedItems, history, saved] = await Promise.all([
    db.select().from(opportunityItems).where(eq10(opportunityItems.opportunityId, id)),
    db.select().from(opportunityHistory).where(eq10(opportunityHistory.opportunityId, id)).orderBy(desc7(opportunityHistory.happenedAt)).limit(30),
    db.select({ id: favorites.id }).from(favorites).where(and9(eq10(favorites.userId, userId), eq10(favorites.opportunityId, id))).limit(1)
  ]);
  let items = storedItems;
  if (!items.length) {
    try {
      const recovered = await indexOpportunityItems({
        id: row.opportunity.id,
        agencyCnpj: row.opportunity.agencyCnpj,
        year: row.opportunity.year,
        controlNumber: row.opportunity.controlNumber,
        rawData: row.opportunity.rawData
      });
      if (recovered.length) items = recovered;
    } catch {
    }
  }
  return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, sourceCode: row.sourceCode, isFavorite: saved.length > 0, items, history };
}
async function listFavorites(userId) {
  const rows = await getDb().select({ opportunity: opportunities, sourceName: connectors.name }).from(favorites).innerJoin(opportunities, eq10(favorites.opportunityId, opportunities.id)).innerJoin(connectors, eq10(opportunities.connectorId, connectors.id)).where(eq10(favorites.userId, userId)).orderBy(desc7(opportunities.lastSyncedAt), desc7(favorites.createdAt));
  return rows.map((row) => {
    return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, isFavorite: true };
  });
}
async function toggleFavorite(userId, opportunityId) {
  const db = getDb();
  const existing = await db.select({ id: favorites.id }).from(favorites).where(and9(eq10(favorites.userId, userId), eq10(favorites.opportunityId, opportunityId))).limit(1);
  if (existing.length) {
    await db.delete(favorites).where(eq10(favorites.id, existing[0].id));
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
  const [all, open, closingToday, closingSoon, fresh, withoutDeadline, value, savedCount, byState, byModality, sourceRows] = await Promise.all([
    db.select({ n: count3() }).from(opportunities),
    db.select({ n: count3() }).from(opportunities).where(and9(gte(opportunities.proposalDeadline, now), inArray7(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count3() }).from(opportunities).where(and9(gte(opportunities.proposalDeadline, today.start), lt2(opportunities.proposalDeadline, today.end), inArray7(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count3() }).from(opportunities).where(and9(gte(opportunities.proposalDeadline, now), lt2(opportunities.proposalDeadline, nextWeek), inArray7(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count3() }).from(opportunities).where(gte(opportunities.createdAt, day)),
    db.select({ n: count3() }).from(opportunities).where(isNull(opportunities.proposalDeadline)),
    db.select({ n: sum(opportunities.estimatedValue) }).from(opportunities),
    db.select({ n: count3() }).from(favorites).where(eq10(favorites.userId, user.id)),
    db.select({ label: opportunities.state, n: count3() }).from(opportunities).where(inArray7(opportunities.status, OPEN_STATUSES)).groupBy(opportunities.state).orderBy(desc7(count3())).limit(8),
    db.select({ label: opportunities.modality, n: count3() }).from(opportunities).groupBy(opportunities.modality).orderBy(desc7(count3())).limit(8),
    db.select().from(connectors).orderBy(asc2(connectors.name))
  ]);
  const latestRunResult = await db.execute(sql4`
    SELECT DISTINCT ON (connector_id)
      connector_id,
      status,
      started_at,
      finished_at,
      fetched_count,
      inserted_count,
      updated_count,
      error_count,
      error_summary
    FROM public.sync_runs
    ORDER BY connector_id, started_at DESC
  `);
  const latestRuns = latestRunResult.rows;
  const historicalErrorResult = await db.execute(sql4`
    SELECT
      connector_id,
      COUNT(*) FILTER (WHERE status IN ('failed', 'error'))::int AS failed_runs,
      COALESCE(SUM(error_count) FILTER (WHERE status IN ('failed', 'error')), 0)::int AS historical_error_count,
      MAX(started_at) FILTER (WHERE status IN ('failed', 'error')) AS last_failure_at
    FROM public.sync_runs
    GROUP BY connector_id
  `);
  const historicalErrors = historicalErrorResult.rows;
  const latestByConnector = new Map(latestRuns.map((run) => [run.connector_id, run]));
  const historicalByConnector = new Map(historicalErrors.map((row) => [row.connector_id, row]));
  const recentRows = await db.select({ opportunity: opportunities, sourceName: connectors.name }).from(opportunities).innerJoin(connectors, eq10(opportunities.connectorId, connectors.id)).orderBy(desc7(opportunities.lastSyncedAt), desc7(opportunities.publicationDate)).limit(6);
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
    sources: sourceRows.filter((source) => source.enabled || latestByConnector.has(source.id)).map((source) => {
      const latest = latestByConnector.get(source.id);
      const historical = historicalByConnector.get(source.id);
      const latestFailed = latest && ["failed", "error"].includes(latest.status);
      const latestSucceeded = latest && ["completed", "succeeded", "success"].includes(latest.status);
      const status = !source.enabled ? "disabled" : latestFailed ? "error" : latestSucceeded ? "active" : "pending";
      return {
        code: source.code,
        name: source.name,
        status,
        lastRunAt: latest?.finished_at ?? null,
        lastRunStatus: latest?.status ?? null,
        lastRunErrorCount: latestFailed ? latest.error_count : 0,
        lastRunErrorSummary: latestFailed ? latest.error_summary : null,
        historicalErrorRuns: historical?.failed_runs ?? 0,
        historicalErrorCount: historical?.historical_error_count ?? 0,
        lastFailureAt: historical?.last_failure_at ?? null,
        importedCount: source.importedCount,
        errorCount: latestFailed ? latest.error_count : 0
      };
    }),
    recent
  };
}
async function getCompanyIdForUser(userId) {
  const [row] = await getDb().select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq10(companyMembers.userId, userId)).limit(1);
  return row?.companyId ?? null;
}
async function listSavedSearches(userId) {
  return getDb().select().from(savedSearches).where(eq10(savedSearches.userId, userId)).orderBy(desc7(savedSearches.updatedAt));
}
async function saveSearch(userId, name, criteria) {
  const companyId = await getCompanyIdForUser(userId);
  const [row] = await getDb().insert(savedSearches).values({ userId, companyId, name, criteria, updatedAt: /* @__PURE__ */ new Date() }).returning();
  return row;
}
async function deleteSavedSearch(userId, id) {
  const result = await getDb().delete(savedSearches).where(and9(eq10(savedSearches.id, id), eq10(savedSearches.userId, userId))).returning({ id: savedSearches.id });
  return result.length > 0;
}

// server/orbeAiRouter.ts
var OPEN_STATUSES2 = ["published", "receiving_proposals", "open", "in_progress"];
var STOP_WORDS = /* @__PURE__ */ new Set([
  "para",
  "com",
  "sem",
  "por",
  "uma",
  "uns",
  "umas",
  "dos",
  "das",
  "que",
  "de",
  "da",
  "do",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "ao",
  "aos",
  "e",
  "ou",
  "se",
  "ser",
  "ter",
  "mais",
  "menos",
  "sobre",
  "entre",
  "como",
  "pelo",
  "pela",
  "seu",
  "sua",
  "seus",
  "suas",
  "este",
  "esta",
  "item",
  "itens",
  "servico",
  "servicos",
  "material",
  "materiais",
  "aquisicao",
  "contratacao",
  "fornecimento",
  "empresa",
  "publica",
  "municipal",
  "estadual",
  "federal",
  "unidade",
  "pregao",
  "licitacao",
  "licitacoes",
  "edital",
  "editais",
  "processo",
  "registro",
  "preco",
  "precos",
  "compras",
  "orgao",
  "publico",
  "administrativo",
  "contrato",
  "contratos",
  "fornecedor"
]);
function normalize2(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}
function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
}
function money(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function tokens2(value) {
  return normalize2(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
}
function hasTerm(haystack, term) {
  const words = tokens2(haystack);
  const needle = tokens2(term);
  if (!needle.length) return false;
  return words.some((_, index2) => needle.every((word, offset) => words[index2 + offset] === word));
}
function learnedInterestTerms(rows) {
  const frequencies = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const uniqueTokens = new Set(tokens2([row.title, row.description ?? ""].join(" ")).filter((token) => token.length >= 5 && !STOP_WORDS.has(token)));
    for (const token of uniqueTokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return [...frequencies.entries()].filter(([, count6]) => count6 >= 2).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([term]) => term);
}
var orbeAiRouter = router({
  searchBase: protectedProcedure.input(z3.object({
    query: z3.string().trim().min(2).max(160),
    page: z3.number().int().min(1).max(4).default(1)
  })).mutation(async ({ ctx, input }) => {
    const planSummary = await getPlanUsageSummary(ctx.user.id);
    if (!planSummary.hasSubscription || planSummary.plan?.code !== "profissional") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "A busca assistida da Orbe IA \xE9 exclusiva do plano Profissional." });
    }
    const result = await searchOpportunities({
      query: input.query,
      onlyOpen: true,
      page: input.page
    }, ctx.user.id);
    await getDb().insert(auditLogs).values({
      actorUserId: ctx.user.id,
      action: "orbe_ai.search.executed",
      entityType: "orbe_ai_search",
      details: {
        query: input.query,
        total: result.total,
        returned: result.items.length,
        page: result.page,
        source: "synced_database"
      }
    });
    return {
      query: input.query,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      items: result.items.slice(0, 12).map((item) => ({
        id: item.id,
        title: item.title,
        municipality: item.municipality,
        state: item.state,
        estimatedValue: item.estimatedValue,
        proposalDeadline: item.proposalDeadline,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        modality: item.modality,
        agencyName: item.agencyName
      }))
    };
  }),
  radar: protectedProcedure.mutation(async ({ ctx }) => {
    const planSummary = await getPlanUsageSummary(ctx.user.id);
    if (!planSummary.hasSubscription || planSummary.plan?.code !== "profissional") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "O Radar de Licita\xE7\xF5es do Orbe IA \xE9 exclusivo do plano Profissional." });
    }
    const db = getDb();
    const [membership] = await db.select({
      companyId: companyMembers.companyId,
      company: companies,
      profile: companyProfiles
    }).from(companyMembers).innerJoin(companies, eq11(companyMembers.companyId, companies.id)).leftJoin(companyProfiles, eq11(companyProfiles.companyId, companies.id)).where(eq11(companyMembers.userId, ctx.user.id)).limit(1);
    if (!membership) throw new TRPCError4({ code: "NOT_FOUND", message: "N\xE3o encontramos uma empresa vinculada \xE0 sua conta." });
    const profile = membership.profile;
    const profileTerms = [...new Set([
      membership.company.primarySegment ?? "",
      ...stringList(profile?.segments),
      ...stringList(profile?.products),
      ...stringList(profile?.services),
      ...stringList(profile?.keywords)
    ].map(normalize2).filter((term) => tokens2(term).length > 0))].slice(0, 80);
    const catalogCodes = [...new Set([
      ...stringList(profile?.catmatCodes),
      ...stringList(profile?.catserCodes)
    ].map((code) => code.replace(/\D/g, "")).filter(Boolean))].slice(0, 200);
    if (!profileTerms.length && !catalogCodes.length) {
      throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "Complete o perfil da empresa com produtos, servi\xE7os, segmentos, palavras-chave ou c\xF3digos CATMAT/CATSER para ativar o Radar." });
    }
    const [favoriteRows, followedRows] = await Promise.all([
      db.select({ id: opportunities.id, title: opportunities.title, description: opportunities.description }).from(favorites).innerJoin(opportunities, eq11(favorites.opportunityId, opportunities.id)).where(eq11(favorites.userId, ctx.user.id)).orderBy(desc8(favorites.createdAt)).limit(50),
      db.select({ id: opportunities.id, title: opportunities.title, description: opportunities.description }).from(followedOpportunities).innerJoin(opportunities, eq11(followedOpportunities.opportunityId, opportunities.id)).where(eq11(followedOpportunities.userId, ctx.user.id)).orderBy(desc8(followedOpportunities.updatedAt)).limit(50)
    ]);
    const uniqueInterestRows = [...new Map([...favoriteRows, ...followedRows].map((row) => [row.id, row])).values()];
    const interestTerms = learnedInterestTerms(uniqueInterestRows);
    const servedStates = stringList(profile?.servedStates).map((value) => value.toUpperCase());
    const servedMunicipalities = stringList(profile?.servedMunicipalities).map(normalize2);
    const minimumValue = money(profile?.minimumValue ?? null);
    const maximumValue = money(profile?.maximumValue ?? null);
    const now = /* @__PURE__ */ new Date();
    const PAGE_SIZE = 250;
    let offset = 0;
    let candidateCount = 0;
    let totalMatchedCount = 0;
    const matches = [];
    while (true) {
      const candidateRows = await db.select({
        opportunity: opportunities,
        sourceName: connectors.name,
        sourceCode: connectors.code
      }).from(opportunities).innerJoin(connectors, eq11(opportunities.connectorId, connectors.id)).where(and10(
        inArray8(opportunities.status, OPEN_STATUSES2),
        or6(gte2(opportunities.proposalDeadline, now), isNull2(opportunities.proposalDeadline))
      )).orderBy(desc8(opportunities.lastSyncedAt), desc8(opportunities.publicationDate), asc3(opportunities.id)).limit(PAGE_SIZE).offset(offset);
      if (!candidateRows.length) break;
      offset += candidateRows.length;
      candidateCount += candidateRows.length;
      const candidateIds = candidateRows.map((row) => row.opportunity.id);
      const itemRows = candidateIds.length ? await db.select({
        opportunityId: opportunityItems.opportunityId,
        catalogCode: opportunityItems.catalogCode,
        catalogSystem: opportunityItems.catalogSystem,
        description: opportunityItems.description
      }).from(opportunityItems).where(inArray8(opportunityItems.opportunityId, candidateIds)) : [];
      const itemsByOpportunity = /* @__PURE__ */ new Map();
      for (const item of itemRows) {
        const list = itemsByOpportunity.get(item.opportunityId) ?? [];
        list.push(item);
        itemsByOpportunity.set(item.opportunityId, list);
      }
      const pageMatches = candidateRows.flatMap(({ opportunity, sourceName, sourceCode }) => {
        if (servedStates.length && (!opportunity.state || !servedStates.includes(opportunity.state.toUpperCase()))) return [];
        if (servedMunicipalities.length && (!opportunity.municipality || !servedMunicipalities.some((city) => normalize2(opportunity.municipality ?? "").includes(city)))) return [];
        const value = money(opportunity.estimatedValue);
        if (value !== null && minimumValue !== null && value < minimumValue) return [];
        if (value !== null && maximumValue !== null && value > maximumValue) return [];
        const searchable = [
          opportunity.title,
          opportunity.description ?? "",
          opportunity.agencyName ?? "",
          opportunity.procurementType ?? "",
          opportunity.modality ?? ""
        ].join(" ");
        const explicitTerms = [
          ...stringList(profile?.products).map((term) => ({ term, weight: 35 })),
          ...stringList(profile?.services).map((term) => ({ term, weight: 35 })),
          ...stringList(profile?.keywords).map((term) => ({ term, weight: 20 })),
          ...stringList(profile?.segments).map((term) => ({ term, weight: 12 }))
        ];
        const matchedExplicit = explicitTerms.filter((entry) => hasTerm(searchable, entry.term));
        const matchedProfileTerms = matchedExplicit.map((entry) => entry.term).slice(0, 5);
        const primarySegmentMatch = Boolean(membership.company.primarySegment && hasTerm(searchable, membership.company.primarySegment));
        const matchedInterestTerms = interestTerms.filter((term) => hasTerm(searchable, term)).slice(0, 3);
        const opportunityItemsForMatch = itemsByOpportunity.get(opportunity.id) ?? [];
        const matchingItems = opportunityItemsForMatch.filter((item) => {
          const itemText = [item.description, item.catalogCode ?? "", item.catalogSystem ?? ""].join(" ");
          const code = (item.catalogCode ?? "").replace(/\D/g, "");
          const codeMatch = code && catalogCodes.some((target) => code === target);
          const termMatch = explicitTerms.some((entry) => entry.weight >= 20 && hasTerm(itemText, entry.term));
          return Boolean(codeMatch || termMatch);
        });
        const matchedCatalogCodes = opportunityItemsForMatch.filter((item) => catalogCodes.includes((item.catalogCode ?? "").replace(/\D/g, ""))).map((item) => item.catalogCode).filter((code) => Boolean(code));
        const reasons = [];
        let score = Math.min(70, matchedExplicit.reduce((sum3, entry) => sum3 + entry.weight, 0));
        if (matchedProfileTerms.length) reasons.push("Correspond\xEAncia no perfil: " + matchedProfileTerms.join(", "));
        if (primarySegmentMatch && !matchedProfileTerms.length) {
          score += 8;
          reasons.push("Segmento geral da empresa relacionado \u2014 ader\xEAncia fraca");
        }
        if (matchedInterestTerms.length) {
          score += Math.min(8, matchedInterestTerms.length * 3);
          reasons.push("Interesse complementar observado nos seus favoritos: " + matchedInterestTerms.join(", "));
        }
        if (matchingItems.length) {
          score += 25;
          reasons.push("Descri\xE7\xE3o de item compat\xEDvel com produto/servi\xE7o cadastrado");
        }
        if (matchedCatalogCodes.length) {
          score += 40;
          reasons.push("C\xF3digo CATMAT/CATSER correspondente: " + [...new Set(matchedCatalogCodes)].join(", "));
        }
        if (score < 25) return [];
        return [{
          id: opportunity.id,
          title: opportunity.title,
          description: opportunity.description,
          agencyName: opportunity.agencyName,
          municipality: opportunity.municipality,
          state: opportunity.state,
          estimatedValue: opportunity.estimatedValue,
          proposalDeadline: opportunity.proposalDeadline,
          sourceName,
          sourceCode,
          score: Math.min(100, score),
          reasons,
          needsDeadlineCheck: !opportunity.proposalDeadline
        }];
      });
      totalMatchedCount += pageMatches.length;
      matches.push(...pageMatches);
      matches.sort((a, b) => b.score - a.score);
      if (matches.length > 40) matches.length = 40;
      if (candidateRows.length < PAGE_SIZE) break;
    }
    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id,
      companyId: membership.companyId,
      action: "orbe_ai.radar.executed",
      entityType: "orbe_ai",
      entityId: membership.companyId,
      details: {
        matchedCount: totalMatchedCount,
        displayedCount: matches.length,
        candidateCount,
        coverageLimited: false,
        itemRowsLimited: false,
        learnedInterestTerms: interestTerms.length,
        matchingMode: "weighted_relevance_threshold_v3",
        provider: "internal",
        planCode: planSummary.plan?.code ?? null
      }
    });
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      candidateCount,
      matchedCount: totalMatchedCount,
      displayedCount: matches.length,
      coverageLimited: false,
      itemRowsLimited: false,
      learnedInterestCount: interestTerms.length,
      profileReady: true,
      items: matches
    };
  }),
  chatConversations: protectedProcedure.query(async ({ ctx }) => {
    const rows = await getDb().select({
      conversationId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
      details: auditLogs.details
    }).from(auditLogs).where(and10(
      eq11(auditLogs.actorUserId, ctx.user.id),
      eq11(auditLogs.action, "orbe_ai.chat.message")
    )).orderBy(desc8(auditLogs.createdAt)).limit(300);
    const conversations = /* @__PURE__ */ new Map();
    for (const row of rows) {
      if (!row.conversationId || conversations.has(row.conversationId)) continue;
      conversations.set(row.conversationId, {
        conversationId: row.conversationId,
        updatedAt: row.createdAt,
        preview: typeof row.details.content === "string" ? row.details.content.slice(0, 110) : "Conversa"
      });
    }
    return [...conversations.values()].slice(0, 12);
  }),
  chatHistory: protectedProcedure.input(z3.object({ conversationId: z3.string().uuid() })).query(async ({ ctx, input }) => {
    const rows = await getDb().select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      details: auditLogs.details
    }).from(auditLogs).where(and10(
      eq11(auditLogs.actorUserId, ctx.user.id),
      eq11(auditLogs.action, "orbe_ai.chat.message"),
      eq11(auditLogs.entityId, input.conversationId)
    )).orderBy(asc3(auditLogs.createdAt)).limit(60);
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      role: row.details.role === "assistant" ? "assistant" : "user",
      content: typeof row.details.content === "string" ? row.details.content : ""
    }));
  }),
  chatSend: protectedProcedure.input(z3.object({
    conversationId: z3.string().uuid(),
    message: z3.string().trim().min(1).max(3e3)
  })).mutation(async ({ ctx, input }) => {
    const planSummary = await getPlanUsageSummary(ctx.user.id);
    if (!planSummary.hasSubscription || planSummary.plan?.code !== "profissional") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "O chat da Orbe IA \xE9 exclusivo do plano Profissional." });
    }
    const db = getDb();
    const dayStart = /* @__PURE__ */ new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [dailyUsage] = await db.select({ total: count4() }).from(auditLogs).where(and10(
      eq11(auditLogs.actorUserId, ctx.user.id),
      eq11(auditLogs.action, "orbe_ai.chat.message"),
      gte2(auditLogs.createdAt, dayStart)
    ));
    if ((dailyUsage?.total ?? 0) >= 60) {
      throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Voc\xEA atingiu o limite di\xE1rio de mensagens da Orbe IA. Tente novamente amanh\xE3." });
    }
    const [membership] = await db.select({
      companyId: companyMembers.companyId,
      company: companies,
      profile: companyProfiles
    }).from(companyMembers).innerJoin(companies, eq11(companyMembers.companyId, companies.id)).leftJoin(companyProfiles, eq11(companyProfiles.companyId, companies.id)).where(eq11(companyMembers.userId, ctx.user.id)).limit(1);
    if (!membership) throw new TRPCError4({ code: "NOT_FOUND", message: "N\xE3o encontramos uma empresa vinculada \xE0 sua conta." });
    const previous = await db.select({ details: auditLogs.details }).from(auditLogs).where(and10(
      eq11(auditLogs.actorUserId, ctx.user.id),
      eq11(auditLogs.action, "orbe_ai.chat.message"),
      eq11(auditLogs.entityId, input.conversationId)
    )).orderBy(desc8(auditLogs.createdAt)).limit(12);
    const history = previous.reverse().flatMap((row) => {
      const role = row.details.role === "assistant" ? "model" : "user";
      const content = typeof row.details.content === "string" ? row.details.content : "";
      return content ? [{ role, parts: [{ text: content }] }] : [];
    });
    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id,
      companyId: membership.companyId,
      action: "orbe_ai.chat.message",
      entityType: "orbe_ai_conversation",
      entityId: input.conversationId,
      details: { role: "user", content: input.message }
    });
    const profile = membership.profile;
    const companyContext = {
      empresa: membership.company.legalName,
      segmentoPrincipal: membership.company.primarySegment,
      produtos: stringList(profile?.products),
      servicos: stringList(profile?.services),
      segmentos: stringList(profile?.segments),
      palavrasChave: stringList(profile?.keywords),
      estadosAtendidos: stringList(profile?.servedStates),
      municipiosAtendidos: stringList(profile?.servedMunicipalities),
      codigosCATMAT: stringList(profile?.catmatCodes),
      codigosCATSER: stringList(profile?.catserCodes)
    };
    const systemInstruction = "Voc\xEA \xE9 a Orbe IA, assistente especializada em licita\xE7\xF5es p\xFAblicas brasileiras, integrada \xE0 plataforma OrbeEdital. Responda em portugu\xEAs brasileiro, com clareza e orienta\xE7\xE3o pr\xE1tica. Use o contexto da empresa abaixo para personalizar recomenda\xE7\xF5es, mas n\xE3o invente dados, oportunidades, prazos, valores, regras de edital, documentos ou resultados de consultas. Voc\xEA n\xE3o tem acesso em tempo real a toda a base de oportunidades nesta conversa: quando o usu\xE1rio pedir uma busca atual, explique que deve executar o Radar ou abrir Oportunidades; n\xE3o simule resultados. Para an\xE1lise de edital espec\xEDfico, solicite o identificador/link ou oriente abrir a oportunidade e usar a an\xE1lise de edital. Diferencie orienta\xE7\xE3o geral de exig\xEAncia comprovada no edital. N\xE3o garanta habilita\xE7\xE3o, vit\xF3ria ou conformidade jur\xEDdica; indique pontos para confer\xEAncia humana. Sugira pr\xF3ximos passos objetivos e evite respostas longas quando n\xE3o necess\xE1rio. Contexto cadastrado da empresa: " + JSON.stringify(companyContext);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "A configura\xE7\xE3o da Orbe IA est\xE1 indispon\xEDvel no momento." });
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [...history, { role: "user", parts: [{ text: input.message }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.35 }
        }),
        signal: AbortSignal.timeout(45e3)
      });
      if (!response.ok) throw new Error("Gemini HTTP " + response.status);
      const payload = await response.json();
      const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!answer) throw new Error("Resposta vazia do modelo");
      await db.insert(auditLogs).values({
        actorUserId: ctx.user.id,
        companyId: membership.companyId,
        action: "orbe_ai.chat.message",
        entityType: "orbe_ai_conversation",
        entityId: input.conversationId,
        details: { role: "assistant", content: answer, model, ...payload.usageMetadata ?? {} }
      });
      return { conversationId: input.conversationId, content: answer };
    } catch (error) {
      console.error("[orbe-ai-chat] generation failed", error instanceof Error ? error.message : "unknown");
      throw new TRPCError4({ code: "BAD_GATEWAY", message: "N\xE3o consegui gerar uma resposta agora. Tente novamente em instantes." });
    }
  }),
  adminUsage: superadminProcedure.query(async () => {
    return getDb().select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      details: auditLogs.details,
      userName: users.name,
      userEmail: users.email,
      companyName: companies.legalName
    }).from(auditLogs).leftJoin(users, eq11(auditLogs.actorUserId, users.id)).leftJoin(companies, eq11(auditLogs.companyId, companies.id)).where(inArray8(auditLogs.action, ["orbe_ai.radar.executed", "orbe_ai.search.executed", "orbe_ai.edital_analysis.completed", "orbe_ai.edital_analysis.failed", "orbe_ai.chat.message"])).orderBy(desc8(auditLogs.createdAt)).limit(100);
  })
});

// server/_core/systemRouter.ts
import { z as z4 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError5 } from "@trpc/server";

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
    throw new TRPCError5({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError5({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError5({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError5({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError5({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError5({
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

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z4.object({
      timestamp: z4.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z4.object({
      title: z4.string().min(1, "title is required"),
      content: z4.string().min(1, "content is required")
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
import { and as and11, eq as eq12, inArray as inArray9, or as or7, sql as sql5 } from "drizzle-orm";

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
  const date2 = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date2.getTime()) || date2.toISOString().slice(0, 10) !== value) {
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
  const date2 = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!match || !date2 || date2.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) {
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
function dateOnly(date2, compact) {
  const iso = date2.toISOString().slice(0, 10);
  return compact ? iso.replace(/-/g, "") : iso;
}
async function syncConnector(sourceCode, input = {}) {
  await ensureBuiltInConnectors();
  const db = getDb();
  const [source] = await db.select().from(connectors).where(eq12(connectors.code, sourceCode)).limit(1);
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
  await db.update(connectors).set({ status: "running", lastRunAt: runStartedAt, updatedAt: /* @__PURE__ */ new Date() }).where(eq12(connectors.id, source.id));
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
          const pages = sourceCode === "pncp" ? mode === "open" ? await searchPncpOpen({ dataFinal: dateOnly(now, true), page: input.startPage ?? 1, maxPages, allPages, tamanhoPagina: pageSize }) : await searchPncp({ dataInicial: dateOnly(from, true), dataFinal: dateOnly(now, true), codigoModalidadeContratacao: modalityCode, page: input.startPage ?? 1, maxPages, allPages, tamanhoPagina: pageSize }) : await searchCompras({ dataPublicacaoPncpInicial: dateOnly(from, false), dataPublicacaoPncpFinal: dateOnly(now, false), codigoModalidade: modalityCode, page: 1, maxPages, allPages, tamanhoPagina: pageSize });
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
            const sameSourceCondition = and11(eq12(opportunities.connectorId, source.id), inArray9(opportunities.sourceKey, sourceKeys));
            const lookupConditions = [sameSourceCondition];
            if (controlNumbers.length) lookupConditions.push(inArray9(opportunities.controlNumber, controlNumbers));
            const lookupCondition = or7(...lookupConditions);
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
                    connectorId: sql5`excluded.connector_id`,
                    sourceKey: sql5`excluded.source_key`,
                    controlNumber: sql5`excluded.control_number`,
                    procurementNumber: sql5`excluded.procurement_number`,
                    processNumber: sql5`excluded.process_number`,
                    year: sql5`excluded.year`,
                    modality: sql5`excluded.modality`,
                    procurementType: sql5`excluded.procurement_type`,
                    title: sql5`excluded.title`,
                    description: sql5`excluded.description`,
                    summary: sql5`excluded.summary`,
                    agencyName: sql5`excluded.agency_name`,
                    unitName: sql5`excluded.unit_name`,
                    agencyCnpj: sql5`excluded.agency_cnpj`,
                    state: sql5`excluded.state`,
                    municipality: sql5`excluded.municipality`,
                    address: sql5`excluded.address`,
                    publicationDate: sql5`excluded.publication_date`,
                    openingDate: sql5`excluded.opening_date`,
                    sessionAt: sql5`excluded.session_at`,
                    proposalDeadline: sql5`excluded.proposal_deadline`,
                    estimatedValue: sql5`excluded.estimated_value`,
                    awardedValue: sql5`excluded.awarded_value`,
                    status: sql5`excluded.status`,
                    judgmentCriterion: sql5`excluded.judgment_criterion`,
                    disputeMode: sql5`excluded.dispute_mode`,
                    sourceUrl: sql5`excluded.source_url`,
                    noticeUrl: sql5`excluded.notice_url`,
                    documents: sql5`excluded.documents`,
                    itemCount: sql5`excluded.item_count`,
                    lastSourceUpdateAt: sql5`excluded.last_source_update_at`,
                    lastSyncedAt: sql5`excluded.last_synced_at`,
                    rawData: sql5`excluded.raw_data`,
                    updatedAt: sql5`excluded.updated_at`
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
    await db.update(syncRuns).set({ status: "completed", finishedAt: /* @__PURE__ */ new Date(), fetchedCount: fetched, insertedCount: inserted, updatedCount: updated, errorCount: failures.length, metadata: { ...runMetadata, pagesFetched, pageStats, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, skipped } }).where(eq12(syncRuns.id, run.id));
    await db.update(connectors).set({ status: "active", importedCount: source.importedCount + inserted, errorCount: source.errorCount, lastError: null, averageDurationMs: duration, nextRunAt: new Date(Date.now() + source.frequencySeconds * 1e3), updatedAt: /* @__PURE__ */ new Date() }).where(eq12(connectors.id, source.id));
    return { sourceCode, mode, pagesFetched, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, lastPage: pageStats.at(-1)?.page ?? input.startPage ?? 1, reportedTotalPages: pageStats.at(-1)?.totalPages ?? null, fetched, inserted, updated, skipped, durationMs: duration, runId: run.id };
  } catch (error) {
    const duration = Date.now() - durationStart;
    const errorCode = error instanceof ConnectorError ? `${error.code}${error.status ? `_${error.status}` : ""}` : "sync_failed";
    await db.update(syncRuns).set({ status: "failed", finishedAt: /* @__PURE__ */ new Date(), fetchedCount: fetched, insertedCount: inserted, updatedCount: updated, errorCount: 1, errorSummary: errorCode, metadata: { ...runMetadata, pagesFetched, pageStats, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, skipped } }).where(eq12(syncRuns.id, run.id));
    await db.update(connectors).set({ status: "error", errorCount: source.errorCount + 1, lastError: errorCode, averageDurationMs: duration, updatedAt: /* @__PURE__ */ new Date() }).where(eq12(connectors.id, source.id));
    throw new Error(`Falha ao consultar a fonte oficial (${errorCode}).`);
  }
}

// server/services/editalAnalysis.ts
import { TRPCError as TRPCError6 } from "@trpc/server";
import { eq as eq13 } from "drizzle-orm";
function formatPncpBrazilDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (local) return `${local[3]}/${local[2]}/${local[1]} \xE0s ${local[4]}:${local[5]} (hor\xE1rio de Bras\xEDlia)`;
  const dateOnly2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly2) return `${dateOnly2[3]}/${dateOnly2[2]}/${dateOnly2[1]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(parsed) + " (hor\xE1rio de Bras\xEDlia)";
  }
  return raw;
}
async function logAnalysisAudit(userId, opportunityId, action, details) {
  try {
    const db = getDb();
    const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq13(companyMembers.userId, userId)).limit(1);
    await db.insert(auditLogs).values({
      actorUserId: userId,
      companyId: membership?.companyId ?? null,
      action,
      entityType: "opportunity",
      entityId: opportunityId,
      details
    });
  } catch (error) {
    console.warn("[edital-analysis] audit log could not be saved", error instanceof Error ? error.message : "unknown");
  }
}
async function getPncpDateMetadata(opportunityId) {
  const [row] = await getDb().select({
    controlNumber: opportunities.controlNumber,
    rawData: opportunities.rawData
  }).from(opportunities).where(eq13(opportunities.id, opportunityId)).limit(1);
  const rawData = row?.rawData && typeof row.rawData === "object" ? row.rawData : {};
  const raw = rawData.raw && typeof rawData.raw === "object" ? rawData.raw : rawData;
  return {
    controlNumber: row?.controlNumber ?? (typeof raw.numeroControlePNCP === "string" ? raw.numeroControlePNCP : null),
    publicationAt: formatPncpBrazilDate(raw.dataPublicacaoPncp),
    proposalReceiptStartsAt: formatPncpBrazilDate(raw.dataAberturaProposta ?? raw.dataAberturaPropostaPncp),
    proposalReceiptEndsAt: formatPncpBrazilDate(raw.dataEncerramentoProposta ?? raw.dataEncerramentoPropostaPncp)
  };
}
async function discoverPncpDocuments(opportunityId) {
  const [row] = await getDb().select({
    sourceKey: opportunities.sourceKey,
    controlNumber: opportunities.controlNumber,
    agencyCnpj: opportunities.agencyCnpj,
    year: opportunities.year,
    procurementNumber: opportunities.procurementNumber,
    rawData: opportunities.rawData
  }).from(opportunities).where(eq13(opportunities.id, opportunityId)).limit(1);
  if (!row) return [];
  const rawData = row.rawData && typeof row.rawData === "object" ? row.rawData : {};
  const raw = rawData.raw && typeof rawData.raw === "object" ? rawData.raw : rawData;
  const organization = raw.orgaoEntidade && typeof raw.orgaoEntidade === "object" ? raw.orgaoEntidade : {};
  const sourceParts = row.sourceKey.split("/");
  const controlNumber = String(
    row.controlNumber || raw.numeroControlePNCP || raw.numeroControlePncp || raw.codigoControlePNCP || ""
  ).trim();
  const controlMatch = controlNumber.match(/^([A-Za-z0-9]{14})-\d+-(\d{1,})\/(\d{4})$/);
  const cnpj = String(
    controlMatch?.[1] || row.agencyCnpj || raw.orgaoEntidadeCnpj || organization.cnpj || (sourceParts[0]?.replace(/[^A-Za-z0-9]/g, "").length === 14 ? sourceParts[0] : "")
  ).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const year = String(
    controlMatch?.[3] || raw.anoCompraPncp || raw.anoCompra || row.year || (sourceParts.length >= 3 ? sourceParts[1] : "")
  );
  const sequential = String(
    controlMatch?.[2] || raw.sequencialCompraPncp || raw.sequencialCompra || (sourceParts.length >= 3 ? sourceParts[2] : "")
  ).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!/^[A-Z0-9]{14}$/.test(cnpj) || !/^\d{4}$/.test(year) || !/^\d+$/.test(sequential)) {
    console.warn("[edital-analysis] PNCP lookup skipped: missing or invalid procurement identifiers", {
      hasCnpj: Boolean(cnpj),
      year,
      hasSequential: Boolean(sequential),
      hasControlNumber: Boolean(controlNumber)
    });
    return [];
  }
  const procurementPath = "/v1/orgaos/" + encodeURIComponent(cnpj) + "/compras/" + year + "/" + sequential;
  const listUrl = "https://pncp.gov.br/api/pncp" + procurementPath + "/arquivos";
  const downloadBase = "https://pncp.gov.br/api/pncp" + procurementPath + "/arquivos/";
  try {
    const response = await fetch(listUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      console.warn("[edital-analysis] PNCP attachment list returned HTTP", response.status);
      return [];
    }
    const payload = await response.json();
    const found = [];
    const visited = /* @__PURE__ */ new Set();
    const walk = (node, depth = 0) => {
      if (!node || typeof node !== "object" || visited.has(node) || depth > 7) return;
      visited.add(node);
      if (Array.isArray(node)) {
        for (const item of node) walk(item, depth + 1);
        return;
      }
      const record = node;
      const documentId = record.sequencialDocumento ?? record.sequencialDocumentoPncp ?? record.idDocumento;
      const hasDocumentUrl = [record.url, record.uri, record.link, record.downloadUrl, record.href, record.urlArquivo, record._downloadUrl].some((value) => typeof value === "string" && value.trim());
      const looksLikeDocument = documentId !== void 0 || hasDocumentUrl || typeof record.tipoDocumentoNome === "string" && Boolean(record.titulo || record.nomeArquivo);
      if (looksLikeDocument) {
        const normalizedId = String(documentId ?? "").replace(/\D/g, "");
        found.push({
          ...record,
          ...normalizedId ? { _downloadUrl: downloadBase + encodeURIComponent(normalizedId) } : {}
        });
      }
      for (const key of ["documentos", "arquivos", "data", "content", "resultado", "result", "items", "results", "dados"]) {
        if (record[key] && typeof record[key] === "object") walk(record[key], depth + 1);
      }
    };
    walk(payload);
    return found;
  } catch (error) {
    console.warn("[edital-analysis] PNCP document lookup unavailable", error instanceof Error ? error.message : "unknown");
    return [];
  }
}
function getOfficialPdfs(opportunity, discovered = []) {
  const candidates = [
    ...discovered,
    ...Array.isArray(opportunity.documents) ? opportunity.documents : [],
    { url: opportunity.noticeUrl, name: "Edital" }
  ];
  const seen = /* @__PURE__ */ new Set();
  const documents = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate;
    const rawUrl = [record.url, record.uri, record.link, record.downloadUrl, record.href, record.urlArquivo, record._downloadUrl].find((value) => {
      if (typeof value !== "string" || !value.trim()) return false;
      try {
        const candidate2 = new URL(value);
        const host = candidate2.hostname.toLowerCase();
        return candidate2.protocol === "https:" && (host === "gov.br" || host.endsWith(".gov.br"));
      } catch {
        return false;
      }
    });
    if (typeof rawUrl !== "string") continue;
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const officialHost = host === "gov.br" || host.endsWith(".gov.br");
      const name = [record.tipoDocumentoNome, record.titulo, record.name, record.title, record.nomeArquivo].find((value) => typeof value === "string" && value.trim())?.toString() ?? "Documento oficial";
      const documentType = [
        record.tipoDocumentoNome,
        record.titulo,
        record.name,
        record.title,
        record.nomeArquivo,
        record.extensao,
        record.tipoArquivo
      ].filter((value) => typeof value === "string").join(" ").toLocaleLowerCase("pt-BR");
      const mime = String(record.mimeType ?? record.contentType ?? record.tipoArquivo ?? record.extensao ?? "").toLowerCase();
      const relevantType = /edital|termo de referência|termo de refer[eê]ncia|projeto básico|anexo|retifica|esclarecimento|aviso|minuta|planilha|modelo|estudo técnico|memorial|proposta|impugna/i.test(documentType);
      const isPdf = /\.pdf$/i.test(parsed.pathname) || /\bpdf\b/i.test(documentType) || mime.includes("pdf") || relevantType;
      if (parsed.protocol !== "https:" || !officialHost || !isPdf) continue;
      const url = parsed.toString();
      if (seen.has(url)) continue;
      seen.add(url);
      const kind = /retifica|esclarecimento|impugna/i.test(documentType) ? "retifica\xE7\xE3o/esclarecimento" : /termo de referência|projeto básico|estudo técnico/i.test(documentType) ? "refer\xEAncia t\xE9cnica" : /anexo|planilha|modelo|memorial|proposta/i.test(documentType) ? "anexo" : /edital|aviso|minuta/i.test(documentType) ? "edital/aviso" : "anexo/documento complementar";
      documents.push({ url, name, kind });
    } catch {
    }
  }
  const priority = (kind) => kind === "retifica\xE7\xE3o/esclarecimento" ? 0 : kind === "edital/aviso" ? 1 : kind === "refer\xEAncia t\xE9cnica" ? 2 : 3;
  return documents.sort((a, b) => priority(a.kind) - priority(b.kind));
}
function parseAnalysis(content) {
  const raw = typeof content === "string" ? content : "";
  const cleaned = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  let value;
  try {
    value = JSON.parse(cleaned);
  } catch {
    throw new TRPCError6({ code: "BAD_GATEWAY", message: "A IA retornou uma an\xE1lise em formato inv\xE1lido. Tente novamente." });
  }
  const strings = (key) => Array.isArray(value[key]) ? value[key].filter((item) => typeof item === "string") : [];
  const evidence = Array.isArray(value.evidence) ? value.evidence.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item;
    if (typeof row.topic !== "string" || typeof row.excerpt !== "string") return [];
    return [{ topic: row.topic, page: typeof row.page === "string" ? row.page : null, excerpt: row.excerpt, document: typeof row.document === "string" ? row.document : null }];
  }) : [];
  const nullable = (key) => typeof value[key] === "string" && value[key].trim() ? value[key].trim() : null;
  return {
    executiveSummary: nullable("executiveSummary") ?? [
      nullable("object") ? `Objeto: ${nullable("object")}.` : "",
      nullable("modality") ? `Modalidade: ${nullable("modality")}.` : "",
      nullable("judgmentCriterion") ? `Crit\xE9rio de julgamento: ${nullable("judgmentCriterion")}.` : "",
      nullable("estimatedValue") ? `Valor estimado: ${nullable("estimatedValue")}.` : "",
      nullable("proposalStartAt") ? `Recebimento de propostas a partir de ${nullable("proposalStartAt")}.` : "",
      nullable("proposalDeadline") ? `Prazo final para propostas: ${nullable("proposalDeadline")}.` : "",
      nullable("sessionAt") ? `Sess\xE3o p\xFAblica: ${nullable("sessionAt")}.` : ""
    ].filter(Boolean).join(" "),
    object: nullable("object"),
    modality: nullable("modality"),
    estimatedValue: nullable("estimatedValue"),
    proposalStartAt: nullable("proposalStartAt"),
    proposalDeadline: nullable("proposalDeadline"),
    openingDate: nullable("openingDate"),
    sessionAt: nullable("sessionAt"),
    judgmentCriterion: nullable("judgmentCriterion"),
    qualificationRequirements: strings("qualificationRequirements"),
    documentChecklist: strings("documentChecklist"),
    risks: strings("risks"),
    attentionPoints: strings("attentionPoints"),
    evidence,
    missingInformation: strings("missingInformation"),
    documentAnalyzed: value.documentAnalyzed === true,
    documentName: nullable("documentName"),
    documentsAnalyzed: strings("documentsAnalyzed"),
    documentsNotProcessed: strings("documentsNotProcessed")
  };
}
async function analyzeOpportunityEdital(opportunityId, userId) {
  const startedAt = Date.now();
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  let documentSizeBytes = 0;
  let documentsAnalyzed = [];
  let documentsNotProcessed = [];
  let tokenUsage = {};
  const opportunity = await getOpportunityDetail(opportunityId, userId);
  if (!opportunity) throw new TRPCError6({ code: "NOT_FOUND", message: "A oportunidade n\xE3o foi encontrada." });
  const discoveredDocuments = ["pncp", "compras.gov.br"].includes(opportunity.sourceCode) ? await discoverPncpDocuments(opportunityId) : [];
  const pdfs = getOfficialPdfs(opportunity, discoveredDocuments);
  const pncpDates = ["pncp", "compras.gov.br"].includes(opportunity.sourceCode) ? await getPncpDateMetadata(opportunityId) : null;
  const metadata = {
    title: opportunity.title,
    description: opportunity.description,
    agency: opportunity.agencyName,
    unit: opportunity.unitName,
    modality: opportunity.modality,
    processNumber: opportunity.processNumber,
    estimatedValue: opportunity.estimatedValue,
    pncpOfficialDates: pncpDates,
    // openingDate is intentionally omitted: legacy imports may map proposal start into this field.
    proposalDeadline: pncpDates?.proposalReceiptEndsAt ?? opportunity.proposalDeadline,
    sessionAt: opportunity.sessionAt,
    judgmentCriterion: opportunity.judgmentCriterion,
    disputeMode: opportunity.disputeMode,
    items: opportunity.items.slice(0, 100).map((item) => ({
      number: item.itemNumber,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      estimatedValue: item.estimatedTotalValue
    }))
  };
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    const parts = [{
      text: "Analise esta oportunidade e todos os documentos PDF oficiais anexados nesta solicita\xE7\xE3o. Metadados estruturados n\xE3o equivalem \xE0 leitura do edital. Cada arquivo ser\xE1 identificado pelo nome e tipo; cite a p\xE1gina e o documento de origem nas evid\xEAncias.\\n" + JSON.stringify({ metadata, documentosOficiaisLocalizados: pdfs.map((doc) => ({ nome: doc.name, tipo: doc.kind })) })
    }];
    const maxAggregateBytes = 40 * 1024 * 1024;
    for (const document of pdfs) {
      try {
        const pdfResponse = await fetch(document.url, {
          headers: { Accept: "application/pdf" },
          signal: AbortSignal.timeout(2e4)
        });
        if (!pdfResponse.ok) {
          documentsNotProcessed.push(document.name + " (download HTTP " + pdfResponse.status + ")");
          continue;
        }
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
          documentsNotProcessed.push(document.name + " (arquivo n\xE3o \xE9 um PDF v\xE1lido)");
          continue;
        }
        if (documentSizeBytes + pdfBuffer.length > maxAggregateBytes) {
          documentsNotProcessed.push(document.name + " (limite total de 40 MB por an\xE1lise atingido)");
          continue;
        }
        documentSizeBytes += pdfBuffer.length;
        documentsAnalyzed.push(document.name);
        parts.push({
          text: "Documento oficial: " + document.name + ". Categoria: " + document.kind + "."
        });
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBuffer.toString("base64")
          }
        });
      } catch (error) {
        documentsNotProcessed.push(document.name + " (falha ao baixar: " + (error instanceof Error ? error.message : "erro desconhecido") + ")");
      }
    }
    if (pdfs.length && !documentsAnalyzed.length) {
      throw new Error("Nenhum dos PDFs oficiais localizados p\xF4de ser baixado e validado");
    }
    const systemInstruction = "Voc\xEA \xE9 um analista t\xE9cnico de licita\xE7\xF5es p\xFAblicas brasileiras. Analise exclusivamente o conte\xFAdo fornecido. N\xE3o invente datas, valores, documentos, p\xE1ginas, artigos ou exig\xEAncias. Diferencie informa\xE7\xE3o encontrada no documento de metadados da oportunidade. REGRA CR\xCDTICA DE DATAS: em pncpOfficialDates, publicationAt \xE9 a divulga\xE7\xE3o no PNCP; proposalReceiptStartsAt \xE9 o IN\xCDCIO do recebimento de propostas; proposalReceiptEndsAt \xE9 o FIM do recebimento de propostas. O fim do recebimento n\xE3o \xE9 o in\xEDcio, e nenhum desses campos deve ser confundido automaticamente com a sess\xE3o p\xFAblica. Compare somente eventos equivalentes: in\xEDcio com in\xEDcio, fim com fim e sess\xE3o p\xFAblica com sess\xE3o p\xFAblica. Nunca compare o in\xEDcio do recebimento com a data da sess\xE3o para declarar diverg\xEAncia. Se o fim do recebimento e a sess\xE3o p\xFAblica tiverem a mesma data e hora, trate como consistentes. Quando pncpOfficialDates trouxer datas, use-as como fonte estruturada priorit\xE1ria para os campos proposalStartAt e proposalDeadline; preserve o hor\xE1rio de Bras\xEDlia indicado e n\xE3o aplique deslocamento UTC. openingDate deve representar somente a data de abertura indicada no documento, e sessionAt somente a sess\xE3o p\xFAblica. Se houver diverg\xEAncia real entre o mesmo evento nos metadados e no edital, registre ambos em attentionPoints e missingInformation. Se n\xE3o localizar algo, use null ou lista vazia e inclua em missingInformation. Datas sem fuso devem ser reproduzidas como aparecem. Aponte riscos como pontos para revis\xE3o humana, nunca como conclus\xE3o jur\xEDdica. Para cada evid\xEAncia, forne\xE7a o nome do documento de origem, p\xE1gina somente se estiver vis\xEDvel e um trecho curto fiel ao documento. Responda apenas JSON v\xE1lido com as chaves: executiveSummary, object, modality, estimatedValue, proposalStartAt, proposalDeadline, openingDate, sessionAt, judgmentCriterion, qualificationRequirements, documentChecklist, risks, attentionPoints, evidence (objetos topic,page,excerpt,document), missingInformation, documentAnalyzed, documentName. Se nenhum PDF foi anexado, deixe documentAnalyzed=false e explique a limita\xE7\xE3o em missingInformation. N\xE3o trate metadados como se fossem conte\xFAdo lido do edital.";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 3500
        }
      }),
      signal: AbortSignal.timeout(9e4)
    });
    if (!response.ok) {
      const providerError = await response.json().catch(() => null);
      throw new Error(`Gemini API failed with HTTP ${response.status}: ${providerError?.error?.message || "provider request rejected"}`);
    }
    const payload = await response.json();
    tokenUsage = payload.usageMetadata ?? {};
    const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    const analysis = parseAnalysis(answer);
    if (pncpDates?.proposalReceiptStartsAt) analysis.proposalStartAt = pncpDates.proposalReceiptStartsAt;
    if (pncpDates?.proposalReceiptEndsAt) analysis.proposalDeadline = pncpDates.proposalReceiptEndsAt;
    analysis.attentionPoints = analysis.attentionPoints.filter((point) => {
      const normalized = point.toLocaleLowerCase("pt-BR");
      return !normalized.includes("metadados indicam abertura") && !normalized.includes("openingdate dos metadados") && !normalized.includes("diverg\xEAncia de data de abertura/proposta");
    });
    analysis.missingInformation = analysis.missingInformation.filter((point) => {
      const normalized = point.toLocaleLowerCase("pt-BR");
      return !normalized.includes("openingdate dos metadados") && !normalized.includes("diverg\xEAncia detectada entre a openingdate");
    });
    if (pncpDates?.proposalReceiptStartsAt && pncpDates?.proposalReceiptEndsAt) {
      analysis.missingInformation = analysis.missingInformation.filter(
        (point) => !/diverg[eê]ncia.*(proposta|abertura)/i.test(point)
      );
    }
    analysis.documentsAnalyzed = documentsAnalyzed;
    analysis.documentsNotProcessed = documentsNotProcessed;
    analysis.documentAnalyzed = documentsAnalyzed.length > 0;
    analysis.documentName = documentsAnalyzed.length ? documentsAnalyzed.join("; ") : null;
    if (!documentsAnalyzed.length) {
      analysis.missingInformation.push("Nenhum PDF oficial foi efetivamente processado; a an\xE1lise se limita aos metadados dispon\xEDveis.");
    }
    if (documentsNotProcessed.length) {
      analysis.missingInformation.push("Documentos oficiais localizados, mas n\xE3o processados: " + documentsNotProcessed.join("; "));
    }
    await logAnalysisAudit(userId, opportunityId, "orbe_ai.edital_analysis.completed", {
      provider: "google_gemini",
      model,
      documentAnalyzed: analysis.documentAnalyzed,
      documentName: analysis.documentName,
      documentsAnalyzed,
      documentsNotProcessed,
      documentSizeBytes,
      promptTokenCount: tokenUsage.promptTokenCount ?? null,
      candidatesTokenCount: tokenUsage.candidatesTokenCount ?? null,
      totalTokenCount: tokenUsage.totalTokenCount ?? null,
      elapsedMs: Date.now() - startedAt,
      sourceCode: opportunity.sourceCode
    });
    return {
      opportunityId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      source: opportunity.sourceName,
      sourceUrl: opportunity.noticeUrl ?? opportunity.sourceUrl,
      analysis
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await logAnalysisAudit(userId, opportunityId, "orbe_ai.edital_analysis.failed", {
      provider: "google_gemini",
      model,
      documentAnalyzed: false,
      documentSizeBytes,
      elapsedMs: Date.now() - startedAt,
      error: message.slice(0, 300)
    });
    if (error instanceof TRPCError6) throw error;
    console.error("[edital-analysis] failed", message);
    throw new TRPCError6({ code: "BAD_GATEWAY", message: "N\xE3o foi poss\xEDvel analisar o edital agora. Confira se o documento oficial est\xE1 acess\xEDvel e tente novamente." });
  }
}

// server/routers.ts
var emailSchema = z5.string().trim().email().max(320).transform((value) => value.toLowerCase());
var registerSchema = z5.object({
  name: z5.string().trim().min(2).max(160),
  email: emailSchema,
  phone: z5.string().trim().max(40).optional().or(z5.literal("")),
  password: z5.string().min(10).max(128),
  companyName: z5.string().trim().min(2).max(240),
  cnpj: z5.string().trim().max(18).optional().or(z5.literal("")),
  state: z5.string().trim().length(2).optional().or(z5.literal("")),
  municipality: z5.string().trim().max(160).optional().or(z5.literal("")),
  segment: z5.string().trim().max(200).optional().or(z5.literal(""))
});
var loginSchema = z5.object({ email: emailSchema, password: z5.string().min(1).max(128) });
var stateCodes = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
var opportunitySearchSchema = z5.object({
  query: z5.string().trim().max(160).optional(),
  states: z5.array(z5.enum(stateCodes)).max(27).optional(),
  municipality: z5.string().trim().max(160).optional(),
  modalities: z5.array(z5.string().max(100)).max(20).optional(),
  statuses: z5.array(z5.string().max(60)).max(20).optional(),
  source: z5.enum(["pncp", "compras.gov.br"]).optional(),
  minValue: z5.number().nonnegative().max(1e12).optional(),
  maxValue: z5.number().nonnegative().max(1e12).optional(),
  publishedFrom: z5.string().datetime().optional(),
  publishedTo: z5.string().datetime().optional(),
  deadlineFrom: z5.string().datetime().optional(),
  deadlineTo: z5.string().datetime().optional(),
  onlyOpen: z5.boolean().optional(),
  page: z5.number().int().min(1).max(1e5).optional(),
  pageSize: z5.number().int().min(25).max(25).optional()
}).refine((value) => value.minValue === void 0 || value.maxValue === void 0 || value.minValue <= value.maxValue, { message: "O valor m\xEDnimo n\xE3o pode superar o m\xE1ximo." });
var profileUpdateSchema = z5.object({
  legalName: z5.string().trim().min(2).max(240),
  cnpj: z5.string().trim().max(18).optional().or(z5.literal("")),
  state: z5.string().trim().length(2).optional().or(z5.literal("")),
  municipality: z5.string().trim().max(160).optional().or(z5.literal("")),
  primarySegment: z5.string().trim().max(200).optional().or(z5.literal("")),
  segments: z5.array(z5.string().trim().min(1).max(100)).max(20),
  products: z5.array(z5.string().trim().min(1).max(160)).max(100),
  services: z5.array(z5.string().trim().min(1).max(160)).max(100),
  keywords: z5.array(z5.string().trim().min(1).max(100)).max(100),
  servedStates: z5.array(z5.enum(stateCodes)).max(27),
  servedMunicipalities: z5.array(z5.string().trim().min(1).max(160)).max(100),
  catmatCodes: z5.array(z5.string().trim().min(1).max(40)).max(200),
  catserCodes: z5.array(z5.string().trim().min(1).max(40)).max(200),
  minimumValue: z5.number().nonnegative().max(1e12).nullable(),
  maximumValue: z5.number().nonnegative().max(1e12).nullable()
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
  if (code === "23505") throw new TRPCError7({ code: "CONFLICT", message: "Este e-mail ou CNPJ j\xE1 est\xE1 cadastrado." });
  if (error instanceof Error && error.message.includes("senha deve ter")) throw new TRPCError7({ code: "BAD_REQUEST", message: error.message });
  throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o. Tente novamente." });
}
var appRouter = router({
  system: systemRouter,
  support: supportRouter,
  orbeAi: orbeAiRouter,
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
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
      }
      try {
        await touchLastSignedIn(user.id);
        const { passwordHash: _passwordHash, ...safeUser } = user;
        const session = await createSession(user.id);
        setAuthCookies(ctx.req, ctx.res, session.token);
        return { user: safeUser, emailVerificationRequired: !user.emailVerifiedAt };
      } catch {
        throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel iniciar sua sess\xE3o. Tente novamente." });
      }
    }),
    requestEmailVerification: publicProcedure.input(z5.object({ email: emailSchema.optional() })).mutation(async ({ input, ctx }) => {
      const user = ctx.user ?? (input.email ? await findAccountByEmail(input.email) : null);
      if (!user || user.emailVerifiedAt) return { accepted: true };
      const sent = await issueEmailVerification(user).catch(() => false);
      return ctx.user ? { accepted: true, sent } : { accepted: true };
    }),
    verifyEmail: publicProcedure.input(z5.object({ token: z5.string().min(40).max(50) })).mutation(async ({ input }) => {
      if (!await verifyEmailAction(input.token)) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "O link de confirma\xE7\xE3o \xE9 inv\xE1lido ou expirou. Solicite um novo e-mail." });
      }
      return { verified: true };
    }),
    requestPasswordReset: publicProcedure.input(z5.object({ email: emailSchema })).mutation(async ({ input }) => {
      const user = await findAccountByEmail(input.email);
      if (user) await issuePasswordReset(user).catch(() => false);
      return { accepted: true };
    }),
    resetPassword: publicProcedure.input(z5.object({ token: z5.string().min(40).max(50), password: z5.string().min(10).max(128) })).mutation(async ({ input }) => {
      if (!await resetPasswordAction(input.token, input.password)) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "O link de redefini\xE7\xE3o \xE9 inv\xE1lido ou expirou. Solicite outro." });
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
      const [row] = await getDb().select({ company: companies, profile: companyProfiles, memberRole: companyMembers.memberRole }).from(companyMembers).innerJoin(companies, eq14(companyMembers.companyId, companies.id)).leftJoin(companyProfiles, eq14(companyProfiles.companyId, companies.id)).where(eq14(companyMembers.userId, ctx.user.id)).limit(1);
      if (!row) throw new TRPCError7({ code: "NOT_FOUND", message: "N\xE3o h\xE1 empresa vinculada a esta conta." });
      return { ...row.company, profile: row.profile, memberRole: row.memberRole };
    }),
    updateProfile: protectedProcedure.input(profileUpdateSchema).mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const [membership] = await tx.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq14(companyMembers.userId, ctx.user.id)).limit(1);
        if (!membership) throw new TRPCError7({ code: "NOT_FOUND", message: "N\xE3o h\xE1 empresa vinculada a esta conta." });
        const cnpj = input.cnpj?.replace(/\D/g, "") || null;
        await tx.update(companies).set({ legalName: input.legalName, cnpj, state: input.state?.toUpperCase() || null, municipality: input.municipality || null, primarySegment: input.primarySegment || null, updatedAt: /* @__PURE__ */ new Date() }).where(eq14(companies.id, membership.companyId));
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
    recordSearch: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role === "user") {
        try {
          await recordSearchUsage(ctx.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel validar o limite do plano.";
          throw new TRPCError7({ code: message.includes("limite") ? "TOO_MANY_REQUESTS" : "FORBIDDEN", message });
        }
      }
      return { recorded: true };
    }),
    detail: protectedProcedure.input(z5.object({ id: z5.string().uuid() })).query(async ({ input, ctx }) => {
      const result = await getOpportunityDetail(input.id, ctx.user.id);
      if (!result) throw new TRPCError7({ code: "NOT_FOUND", message: "A oportunidade n\xE3o foi encontrada." });
      return result;
    }),
    analyzeEdital: protectedProcedure.input(z5.object({ id: z5.string().uuid() })).mutation(({ input, ctx }) => analyzeOpportunityEdital(input.id, ctx.user.id))
  }),
  agenda: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const now = /* @__PURE__ */ new Date();
      const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1e3);
      const db = getDb();
      const rows = await db.select({
        opportunity: opportunities,
        sourceName: connectors.name
      }).from(favorites).innerJoin(opportunities, eq14(favorites.opportunityId, opportunities.id)).innerJoin(connectors, eq14(opportunities.connectorId, connectors.id)).where(and12(
        eq14(favorites.userId, ctx.user.id),
        or8(
          and12(gte3(opportunities.proposalDeadline, now), lt3(opportunities.proposalDeadline, horizon)),
          and12(gte3(opportunities.openingDate, now), lt3(opportunities.openingDate, horizon)),
          and12(gte3(opportunities.sessionAt, now), lt3(opportunities.sessionAt, horizon))
        )
      )).orderBy(opportunities.proposalDeadline);
      return rows.map((row) => ({
        ...row.opportunity,
        sourceName: row.sourceName,
        href: `/app/opportunities/${row.opportunity.id}`
      }));
    })
  }),
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db.select().from(notifications).where(eq14(notifications.userId, ctx.user.id)).orderBy(desc9(notifications.createdAt)).limit(100);
      return {
        items: rows,
        unread: rows.filter((item) => !item.readAt).length
      };
    }),
    markRead: protectedProcedure.input(z5.object({ id: z5.string().uuid().optional(), all: z5.boolean().optional() })).mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (input.all) {
        await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(and12(eq14(notifications.userId, ctx.user.id), isNotNull(notifications.id)));
      } else if (input.id) {
        await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(and12(eq14(notifications.userId, ctx.user.id), eq14(notifications.id, input.id)));
      } else {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Informe uma notifica\xE7\xE3o ou solicite marcar todas como lidas." });
      }
      return { updated: true };
    })
  }),
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => listFavorites(ctx.user.id)),
    toggle: protectedProcedure.input(z5.object({ opportunityId: z5.string().uuid() })).mutation(async ({ input, ctx }) => {
      const exists = await getDb().select({ id: opportunities.id }).from(opportunities).where(eq14(opportunities.id, input.opportunityId)).limit(1);
      if (!exists.length) throw new TRPCError7({ code: "NOT_FOUND", message: "A oportunidade n\xE3o foi encontrada." });
      if (ctx.user.role === "user") {
        const [alreadySaved] = await getDb().select({ id: favorites.id }).from(favorites).where(and12(eq14(favorites.userId, ctx.user.id), eq14(favorites.opportunityId, input.opportunityId))).limit(1);
        if (!alreadySaved) {
          try {
            await ensureCanAddFavorite(ctx.user.id);
          } catch (error) {
            throw new TRPCError7({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Limite de favoritos atingido." });
          }
        }
      }
      return { favorited: await toggleFavorite(ctx.user.id, input.opportunityId) };
    })
  }),
  billing: router({
    plans: publicProcedure.query(async () => getDb().select({
      id: plans.id,
      code: plans.code,
      name: plans.name,
      description: plans.description,
      monthlyPriceCents: plans.monthlyPriceCents,
      annualPriceCents: plans.annualPriceCents,
      features: plans.features,
      limits: plans.limits
    }).from(plans).where(and12(eq14(plans.active, true), inArray10(plans.code, ["essencial", "profissional", "teste-gratis"])))),
    usage: authenticatedProcedure.query(({ ctx }) => getPlanUsageSummary(ctx.user.id)),
    resumePlan: authenticatedProcedure.query(async ({ ctx }) => {
      const db = getDb();
      const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq14(companyMembers.userId, ctx.user.id)).limit(1);
      if (!membership) return null;
      const attempts = await db.select({
        id: subscriptions.id,
        code: plans.code,
        status: subscriptions.status,
        provider: subscriptions.provider,
        providerSubscriptionId: subscriptions.providerSubscriptionId
      }).from(subscriptions).innerJoin(plans, eq14(subscriptions.planId, plans.id)).where(eq14(subscriptions.companyId, membership.companyId)).orderBy(desc9(subscriptions.createdAt)).limit(10);
      const latest = attempts[0];
      const priorTestAttempt = attempts.find((item) => item.code === "teste-gratis" && item.status === "failed");
      if (latest?.code === "essencial" && latest.status === "pending" && latest.provider === "mercadopago" && latest.providerSubscriptionId && priorTestAttempt) {
        await cancelMercadoPagoSubscription(latest.id);
        return "teste-gratis";
      }
      const resumableAttempt = attempts.find((item) => item.status !== "cancelled");
      return resumableAttempt?.code ?? null;
    }),
    changePlan: protectedProcedure.input(z5.object({ planId: z5.string().uuid() })).mutation(async ({ input, ctx }) => {
      try {
        return await changeMercadoPagoPlan(ctx.user.id, input.planId);
      } catch (error) {
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel alterar o plano."
        });
      }
    }),
    checkout: authenticatedProcedure.input(z5.object({
      planId: z5.string().uuid(),
      interval: z5.enum(["monthly", "annual"])
    })).mutation(async ({ input, ctx }) => {
      try {
        return await createMercadoPagoCheckout(ctx.user.id, input.planId, input.interval);
      } catch (error) {
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel iniciar a assinatura."
        });
      }
    }),
    pixCheckout: authenticatedProcedure.input(z5.object({
      planId: z5.string().uuid(),
      interval: z5.enum(["monthly", "annual"]).default("monthly"),
      document: z5.string().trim().max(18).optional()
    })).mutation(async ({ input, ctx }) => {
      try {
        return await createMercadoPagoPix(ctx.user.id, input.planId, input.interval, input.document);
      } catch (error) {
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel gerar o Pix."
        });
      }
    }),
    verifyPayment: authenticatedProcedure.mutation(async ({ ctx }) => {
      try {
        return await verifyMercadoPagoPayments(ctx.user.id);
      } catch (error) {
        throw new TRPCError7({
          code: "BAD_GATEWAY",
          message: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel consultar o Mercado Pago."
        });
      }
    }),
    pixStatus: authenticatedProcedure.input(z5.object({
      paymentId: z5.string().trim().min(1).max(80)
    })).query(async ({ input, ctx }) => {
      try {
        return await getMercadoPagoPixStatus(ctx.user.id, input.paymentId);
      } catch (error) {
        throw new TRPCError7({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Cobran\xE7a Pix n\xE3o encontrada."
        });
      }
    })
  }),
  savedSearches: router({
    list: protectedProcedure.query(({ ctx }) => listSavedSearches(ctx.user.id)),
    create: protectedProcedure.input(z5.object({ name: z5.string().trim().min(1).max(100), criteria: z5.record(z5.string(), z5.unknown()) })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "user") {
        try {
          await ensureCanSaveSearch(ctx.user.id);
        } catch (error) {
          throw new TRPCError7({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Limite de pesquisas salvas atingido." });
        }
      }
      const query = typeof input.criteria.query === "string" ? input.criteria.query.trim() : "";
      return saveSearch(ctx.user.id, input.name, { ...input.criteria, query: query || input.name });
    }),
    delete: protectedProcedure.input(z5.object({ id: z5.string().uuid() })).mutation(({ input, ctx }) => deleteSavedSearch(ctx.user.id, input.id))
  }),
  adminUsers: adminUsersRouter,
  admin: router({
    planPricing: router({
      list: superadminProcedure.query(async () => getDb().select({
        id: plans.id,
        code: plans.code,
        name: plans.name,
        monthlyPriceCents: plans.monthlyPriceCents,
        annualPriceCents: plans.annualPriceCents,
        active: plans.active,
        updatedAt: plans.updatedAt
      }).from(plans).where(eq14(plans.active, true))),
      update: superadminProcedure.input(z5.object({
        id: z5.string().uuid(),
        monthlyPriceCents: z5.number().int().min(0).max(1e8),
        annualPriceCents: z5.number().int().min(0).max(1e8)
      })).mutation(async ({ input, ctx }) => {
        const db = getDb();
        return db.transaction(async (tx) => {
          const [previous] = await tx.select().from(plans).where(eq14(plans.id, input.id)).limit(1);
          if (!previous) throw new Error("Plano n\xE3o encontrado");
          const [updated] = await tx.update(plans).set({
            monthlyPriceCents: input.monthlyPriceCents,
            annualPriceCents: input.annualPriceCents,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq14(plans.id, input.id)).returning();
          await tx.insert(auditLogs).values({
            actorUserId: ctx.user.id,
            action: "plan.price.updated",
            entityType: "plan",
            entityId: input.id,
            details: {
              code: previous.code,
              before: { monthlyPriceCents: previous.monthlyPriceCents, annualPriceCents: previous.annualPriceCents },
              after: { monthlyPriceCents: updated.monthlyPriceCents, annualPriceCents: updated.annualPriceCents }
            }
          });
          return { id: updated.id, code: updated.code, monthlyPriceCents: updated.monthlyPriceCents, annualPriceCents: updated.annualPriceCents };
        });
      })
    }),
    radarMgDiscovery: superadminProcedure.mutation(async () => runRadarAutomatic("amm-mg")),
    radarVerify: superadminProcedure.input(z5.object({ id: z5.string().uuid(), deadline: z5.string().datetime({ offset: true }), evidence: z5.string().trim().min(15).max(2e3) })).mutation(({ input }) => verifyRadarCandidate(input.id, input.deadline, input.evidence)),
    radarReview: superadminProcedure.query(() => listRadarReview()),
    radarReviewStatus: superadminProcedure.input(z5.object({ id: z5.string().uuid(), status: z5.enum(["pending", "rejected"]) })).mutation(({ input }) => setRadarReview(input.id, input.status)),
    radarPilot: superadminProcedure.input(z5.object({ source: z5.enum(["amm-mt", "amm-mg"]), ids: z5.array(z5.string().regex(/^[a-f0-9]{8}$/i)).max(5).optional(), saveReview: z5.boolean().optional() }).optional()).mutation(async ({ input }) => {
      const startedAt = /* @__PURE__ */ new Date();
      const source = input?.source ?? "amm-mt";
      const result = source === "amm-mg" ? await runAmmMgPilot(input?.ids ?? []) : await runAmmMtPilot();
      const notices = await compareRadarNotices(result.notices);
      const saved = input?.saveReview ? await persistRadarRun(source, startedAt, notices, result.failures) : null;
      return { ...result, notices, saved, mode: "review" };
    }),
    settings: router({
      get: superadminProcedure.query(async () => {
        const rows = await getDb().select().from(globalSettings);
        return Object.fromEntries(rows.map((row) => [row.key, row.value]));
      }),
      save: superadminProcedure.input(z5.object({
        key: z5.enum(["branding", "experience"]),
        value: z5.record(z5.string(), z5.unknown())
      })).mutation(async ({ input, ctx }) => {
        const [saved] = await getDb().insert(globalSettings).values({ key: input.key, value: input.value, updatedBy: ctx.user.id, updatedAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({ target: globalSettings.key, set: { value: input.value, updatedBy: ctx.user.id, updatedAt: /* @__PURE__ */ new Date() } }).returning();
        await getDb().insert(auditLogs).values({ actorUserId: ctx.user.id, action: "global_settings.updated", entityType: "global_setting", entityId: input.key, details: { keys: Object.keys(input.value) } });
        return saved;
      }),
      announce: superadminProcedure.input(z5.object({ title: z5.string().trim().min(3).max(120), message: z5.string().trim().min(5).max(1e3), audience: z5.enum(["all", "active"]) })).mutation(async ({ input, ctx }) => {
        const db = getDb();
        const recipients = input.audience === "active" ? await db.selectDistinct({ userId: companyMembers.userId }).from(companyMembers).innerJoin(subscriptions, eq14(subscriptions.companyId, companyMembers.companyId)).where(eq14(subscriptions.status, "active")) : await db.select({ userId: users.id }).from(users).where(eq14(users.role, "user"));
        if (!recipients.length) return { sent: 0 };
        const rows = recipients.map((recipient) => ({ userId: recipient.userId, type: "announcement", title: input.title, message: input.message, href: "/app" }));
        for (let offset = 0; offset < rows.length; offset += 500) await db.insert(notifications).values(rows.slice(offset, offset + 500));
        await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "announcement.sent", entityType: "notification", details: { title: input.title, audience: input.audience, recipientCount: rows.length } });
        return { sent: rows.length };
      })
    }),
    overview: sourceOperatorProcedure.query(async () => {
      await ensureBuiltInConnectors();
      const db = getDb();
      const [userCount, opportunityCount, sourceRows, activeSubscribers, canceledSubscriptions] = await Promise.all([
        db.select({ n: count5() }).from(users),
        db.select({ n: count5() }).from(opportunities),
        db.select().from(connectors),
        db.select({ n: count5() }).from(subscriptions).where(eq14(subscriptions.status, "active")),
        db.select({ n: count5() }).from(subscriptions).where(inArray10(subscriptions.status, ["cancelled", "canceled"]))
      ]);
      return { users: userCount[0]?.n ?? 0, opportunities: opportunityCount[0]?.n ?? 0, sourceCount: sourceRows.length, sources: sourceRows, activeSubscribers: activeSubscribers[0]?.n ?? 0, canceledSubscriptions: canceledSubscriptions[0]?.n ?? 0 };
    }),
    sources: router({
      list: sourceOperatorProcedure.query(async () => {
        await ensureBuiltInConnectors();
        const db = getDb();
        const [sources, runs, scheduleEvents] = await Promise.all([
          db.select().from(connectors).orderBy(connectors.name),
          db.select({ run: syncRuns, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq14(syncRuns.connectorId, connectors.id)).orderBy(desc9(syncRuns.startedAt)).limit(50),
          db.select({
            action: auditLogs.action,
            entityId: auditLogs.entityId,
            details: auditLogs.details,
            createdAt: auditLogs.createdAt
          }).from(auditLogs).where(inArray10(auditLogs.action, ["source.schedule.completed", "source.schedule.failed"])).orderBy(desc9(auditLogs.createdAt)).limit(50)
        ]);
        return { sources, runs, scheduleEvents };
      }),
      run: sourceOperatorProcedure.input(z5.object({
        sourceCode: z5.enum(["pncp", "compras.gov.br"]),
        daysBack: z5.number().int().min(1).max(30).default(7),
        modalityCodes: z5.array(z5.number().int().min(1).max(15)).min(1).max(3).default([6]),
        maxPages: z5.number().int().min(1).max(3).default(1)
      })).mutation(async ({ input, ctx }) => {
        const startedAt = /* @__PURE__ */ new Date();
        try {
          const result = await syncConnector(input.sourceCode, input);
          await getDb().insert(auditLogs).values({
            actorUserId: ctx.user.id,
            action: "source.sync.completed",
            entityType: "connector",
            entityId: input.sourceCode,
            details: {
              daysBack: input.daysBack,
              modalityCodes: input.modalityCodes,
              maxPages: input.maxPages,
              inserted: result.inserted,
              updated: result.updated,
              durationMs: Date.now() - startedAt.getTime()
            }
          }).catch((error) => console.error("[admin-audit] source sync log failed", error instanceof Error ? error.message : "unknown"));
          return result;
        } catch (error) {
          await getDb().insert(auditLogs).values({
            actorUserId: ctx.user.id,
            action: "source.sync.failed",
            entityType: "connector",
            entityId: input.sourceCode,
            details: { durationMs: Date.now() - startedAt.getTime(), message: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" }
          }).catch((logError) => console.error("[admin-audit] source sync failure log failed", logError instanceof Error ? logError.message : "unknown"));
          throw error;
        }
      }),
      configure: sourceOperatorProcedure.input(z5.object({
        code: z5.enum(["pncp", "compras.gov.br"]),
        enabled: z5.boolean().optional(),
        frequencySeconds: z5.number().int().min(300).max(86400).optional()
      })).mutation(async ({ input, ctx }) => {
        await ensureBuiltInConnectors();
        const changes = { updatedAt: /* @__PURE__ */ new Date() };
        if (input.enabled !== void 0) changes.enabled = input.enabled;
        if (input.frequencySeconds !== void 0) changes.frequencySeconds = input.frequencySeconds;
        const [source] = await getDb().update(connectors).set(changes).where(eq14(connectors.code, input.code)).returning();
        await getDb().insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "source.configuration.updated",
          entityType: "connector",
          entityId: input.code,
          details: { enabled: input.enabled, frequencySeconds: input.frequencySeconds }
        }).catch((error) => console.error("[admin-audit] source configuration log failed", error instanceof Error ? error.message : "unknown"));
        return source;
      }),
      setScheduledTask: sourceOperatorProcedure.input(z5.object({ code: z5.enum(["pncp", "compras.gov.br"]), taskUid: z5.string().trim().max(200) })).mutation(async ({ input, ctx }) => {
        await ensureBuiltInConnectors();
        const [current] = await getDb().select().from(connectors).where(eq14(connectors.code, input.code)).limit(1);
        if (!current) throw new TRPCError7({ code: "NOT_FOUND", message: "Fonte n\xE3o cadastrada." });
        const configuration = current.configuration && typeof current.configuration === "object" ? current.configuration : {};
        const nextConfiguration = { ...configuration };
        if (input.taskUid) nextConfiguration.scheduledTaskUid = input.taskUid;
        else delete nextConfiguration.scheduledTaskUid;
        const [updated] = await getDb().update(connectors).set({ configuration: nextConfiguration, updatedAt: /* @__PURE__ */ new Date() }).where(eq14(connectors.id, current.id)).returning();
        await getDb().insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "source.schedule_binding.updated",
          entityType: "connector",
          entityId: input.code,
          details: { scheduledTaskConfigured: Boolean(input.taskUid) }
        }).catch((error) => console.error("[admin-audit] schedule binding log failed", error instanceof Error ? error.message : "unknown"));
        return updated;
      })
    }),
    recentRuns: sourceOperatorProcedure.query(() => getDb().select({ run: syncRuns, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq14(syncRuns.connectorId, connectors.id)).orderBy(desc9(syncRuns.startedAt)).limit(100)),
    reconcileRefund: financeProcedure.input(z5.object({ paymentId: z5.string().trim().min(1).max(100) })).mutation(async ({ input, ctx }) => {
      try {
        return await reconcileExternallyRefundedPayment(input.paymentId, ctx.user.id);
      } catch (error) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel sincronizar o estorno." });
      }
    }),
    refundPayment: financeProcedure.input(z5.object({ paymentId: z5.string().trim().min(1).max(100) })).mutation(async ({ input, ctx }) => {
      try {
        return await refundMercadoPagoPayment(input.paymentId, ctx.user.id);
      } catch (error) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel estornar o pagamento." });
      }
    }),
    finance: financeProcedure.query(async () => {
      const db = getDb();
      const [activeSubscriptions, canceledSubscriptions, overdueSubscriptions, activePlans, paymentGroups, paymentGroupsWithDetails] = await Promise.all([
        db.select({ n: count5() }).from(subscriptions).where(eq14(subscriptions.status, "active")),
        db.select({ n: count5() }).from(subscriptions).where(inArray10(subscriptions.status, ["cancelled", "canceled"])),
        db.select({ n: count5() }).from(subscriptions).where(inArray10(subscriptions.status, ["past_due", "expired", "inadimplente"])),
        db.select({ billingInterval: subscriptions.billingInterval, monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents }).from(subscriptions).innerJoin(plans, eq14(subscriptions.planId, plans.id)).where(eq14(subscriptions.status, "active")),
        db.select({ status: payments.status, amountCents: sum2(payments.amountCents) }).from(payments).groupBy(payments.status),
        db.select({
          id: payments.id,
          providerPaymentId: payments.providerPaymentId,
          status: payments.status,
          amountCents: payments.amountCents,
          currency: payments.currency,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          rawStatus: payments.rawStatus,
          subscriptionId: subscriptions.id,
          subscriptionStatus: subscriptions.status,
          billingInterval: subscriptions.billingInterval,
          contractedAt: subscriptions.createdAt,
          periodStart: subscriptions.currentPeriodStart,
          renewalAt: subscriptions.currentPeriodEnd,
          planName: plans.name,
          companyName: companies.legalName,
          companyId: payments.companyId,
          customerName: sql6`(select u.name from company_members cm inner join users u on u.id = cm.user_id where cm.company_id = payments.company_id order by cm.created_at asc limit 1)`,
          customerEmail: sql6`(select u.email from company_members cm inner join users u on u.id = cm.user_id where cm.company_id = payments.company_id order by cm.created_at asc limit 1)`
        }).from(payments).leftJoin(subscriptions, eq14(payments.subscriptionId, subscriptions.id)).leftJoin(plans, eq14(subscriptions.planId, plans.id)).innerJoin(companies, eq14(payments.companyId, companies.id)).orderBy(desc9(payments.createdAt)).limit(100)
      ]);
      const mrrCents = Math.round(activePlans.reduce((total, row) => total + (row.billingInterval === "annual" ? row.annualPriceCents / 12 : row.monthlyPriceCents), 0));
      const byStatus = Object.fromEntries(paymentGroups.map((row) => [row.status, Number(row.amountCents ?? 0)]));
      return {
        configured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET),
        note: process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET ? "Mercado Pago configurado. Os valores abaixo refletem os registros recebidos e confirmados pelo webhook." : "Credenciais do Mercado Pago incompletas; os valores refletem somente registros persistidos.",
        activeSubscriptions: activeSubscriptions[0]?.n ?? 0,
        canceledSubscriptions: canceledSubscriptions[0]?.n ?? 0,
        overdueSubscriptions: overdueSubscriptions[0]?.n ?? 0,
        mrrCents,
        arrCents: mrrCents * 12,
        paymentsByStatus: byStatus,
        payments: paymentGroupsWithDetails,
        approvedRevenueCents: byStatus.approved ?? 0
      };
    })
  })
});

// server/services/scheduled.ts
import { jwtVerify } from "jose";
import { parse as parseCookieHeader3 } from "cookie";
import { eq as eq16, inArray as inArray11 } from "drizzle-orm";

// server/services/deadlineNotifications.ts
import { and as and13, eq as eq15, gte as gte4, isNotNull as isNotNull2, lt as lt4, or as or9 } from "drizzle-orm";
var TIME_ZONE = "America/Sao_Paulo";
var REMINDER_OFFSETS = /* @__PURE__ */ new Set([7, 3, 1, 0]);
function dateKey2(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function dayDifference(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 864e5);
}
async function dispatchDeadlineNotifications() {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const today = dateKey2(now);
  const startOfToday = /* @__PURE__ */ new Date(`${today}T00:00:00-03:00`);
  const horizon = new Date(startOfToday.getTime() + 8 * 864e5);
  const rows = await db.select({
    userId: favorites.userId,
    opportunityId: opportunities.id,
    title: opportunities.title,
    proposalDeadline: opportunities.proposalDeadline,
    openingDate: opportunities.openingDate,
    sessionAt: opportunities.sessionAt
  }).from(favorites).innerJoin(opportunities, eq15(favorites.opportunityId, opportunities.id)).where(or9(
    and13(isNotNull2(opportunities.proposalDeadline), gte4(opportunities.proposalDeadline, startOfToday), lt4(opportunities.proposalDeadline, horizon)),
    and13(isNotNull2(opportunities.openingDate), gte4(opportunities.openingDate, startOfToday), lt4(opportunities.openingDate, horizon)),
    and13(isNotNull2(opportunities.sessionAt), gte4(opportunities.sessionAt, startOfToday), lt4(opportunities.sessionAt, horizon))
  ));
  const events = [];
  for (const row of rows) {
    if (row.proposalDeadline) events.push({ userId: row.userId, opportunityId: row.opportunityId, title: row.title, kind: "deadline", date: row.proposalDeadline });
    if (row.openingDate) events.push({ userId: row.userId, opportunityId: row.opportunityId, title: row.title, kind: "opening", date: row.openingDate });
    if (row.sessionAt) events.push({ userId: row.userId, opportunityId: row.opportunityId, title: row.title, kind: "session", date: row.sessionAt });
  }
  let createdReminders = 0;
  let createdSummaries = 0;
  const upcomingByUser = /* @__PURE__ */ new Map();
  for (const event of events) {
    const days = dayDifference(today, dateKey2(event.date));
    if (days < 0 || days > 7) continue;
    const list = upcomingByUser.get(event.userId) ?? [];
    list.push(event);
    upcomingByUser.set(event.userId, list);
    if (!REMINDER_OFFSETS.has(days)) continue;
    const eventDate = dateKey2(event.date);
    const type = `agenda_${event.kind}_${eventDate}_${days}d`;
    const existing = await db.select({ id: notifications.id }).from(notifications).where(and13(
      eq15(notifications.userId, event.userId),
      eq15(notifications.opportunityId, event.opportunityId),
      eq15(notifications.type, type)
    )).limit(1);
    if (existing.length) continue;
    const label = event.kind === "deadline" ? "Prazo para propostas" : event.kind === "opening" ? "Abertura da licita\xE7\xE3o" : "Sess\xE3o p\xFAblica";
    const timing = days === 0 ? "\xE9 hoje" : days === 1 ? "\xE9 amanh\xE3" : `em ${days} dias`;
    await db.insert(notifications).values({
      userId: event.userId,
      opportunityId: event.opportunityId,
      type,
      title: `${label} ${timing}`,
      message: `A oportunidade "${event.title}" tem ${label.toLocaleLowerCase("pt-BR")} em ${new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(event.date)}.`,
      href: `/app/opportunities/${event.opportunityId}`
    });
    createdReminders += 1;
  }
  for (const [userId, userEvents] of upcomingByUser) {
    const type = `agenda_daily_summary_${today}`;
    const existing = await db.select({ id: notifications.id }).from(notifications).where(and13(eq15(notifications.userId, userId), eq15(notifications.type, type))).limit(1);
    if (existing.length) continue;
    const uniqueOpportunities = new Set(userEvents.map((event) => event.opportunityId)).size;
    await db.insert(notifications).values({
      userId,
      type,
      title: "Resumo di\xE1rio da sua agenda",
      message: `Voc\xEA tem ${userEvents.length} evento(s) nos pr\xF3ximos 7 dias, em ${uniqueOpportunities} oportunidade(s) acompanhada(s).`,
      href: "/app/agenda"
    });
    createdSummaries += 1;
  }
  return { scannedEvents: events.length, createdReminders, createdSummaries };
}

// server/services/scheduled.ts
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
  const supabaseCronSecret = process.env.SUPABASE_CRON_SECRET?.trim();
  if (supabaseCronSecret && request.headers.authorization === `Bearer ${supabaseCronSecret}`) {
    return "supabase-cron:all-sources";
  }
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && request.headers.authorization === `Bearer ${cronSecret}`) {
    return "vercel-cron:compras.gov.br";
  }
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
async function syncScheduledSource(source) {
  if (source.code === "pncp") {
    const configuration = source.configuration && typeof source.configuration === "object" ? source.configuration : {};
    const configuredPage = Number(configuration.nextPncpPage ?? 1);
    const startPage = Number.isInteger(configuredPage) && configuredPage > 0 ? configuredPage : 1;
    const result = await syncConnector("pncp", {
      mode: "open",
      startPage,
      maxPages: 15,
      pageSize: 50
    });
    const totalPages = result.reportedTotalPages ?? result.lastPage;
    const nextPncpPage = result.lastPage >= totalPages ? 1 : result.lastPage + 1;
    await getDb().update(connectors).set({
      configuration: { ...configuration, nextPncpPage },
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq16(connectors.id, source.id));
    return { ...result, pageWindow: { startPage, endPage: result.lastPage, totalPages, nextPncpPage } };
  }
  return syncConnector("compras.gov.br", {
    daysBack: 7,
    modalityCodes: [3, 5, 8, 9, 11, 12, 14, 15, 20],
    allPages: true,
    pageSize: 500
  });
}
async function handleScheduledSync(req) {
  const taskUid = await resolveScheduledTask(req);
  if (taskUid === "supabase-cron:all-sources" && req.query?.task === "items") {
    const result = await indexPncpItems(80);
    await getDb().insert(auditLogs).values({ action: "source.items.indexed", entityType: "connector", entityId: "pncp", details: result }).catch(() => void 0);
    return { status: "indexed", ...result };
  }
  const enabledSources = await getDb().select().from(connectors).where(inArray11(connectors.code, [...CONNECTORS]));
  if (taskUid === "supabase-cron:all-sources") {
    const runs = [];
    if (process.env.ORBERADAR_AUTOCOLLECT === "true") {
      try {
        runs.push({ source: "amm-mt", ...await runRadarAutomatic() });
      } catch {
        runs.push({ source: "amm-mt", status: "failed" });
      }
    }
    if (process.env.ORBERADAR_AMM_MG_DISCOVERY === "true") {
      try {
        runs.push({ source: "amm-mg", ...await runRadarAutomatic("amm-mg") });
      } catch (error) {
        runs.push({ source: "amm-mg", status: "failed", error: error instanceof Error ? error.message.slice(0, 180) : "Unknown error" });
      }
    }
    for (const source of enabledSources.filter((item) => item.enabled)) {
      try {
        const result = await syncScheduledSource(source);
        runs.push({ source: source.code, status: "completed", ...result });
        await getDb().insert(auditLogs).values({
          action: "source.schedule.completed",
          entityType: "connector",
          entityId: source.code,
          details: { status: "synchronized", runId: result.runId, fetched: result.fetched, inserted: result.inserted, updated: result.updated, durationMs: result.durationMs, scheduler: "supabase_cron" }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 240) : "Unknown error";
        runs.push({ source: source.code, status: "failed", error: message });
        await getDb().insert(auditLogs).values({
          action: "source.schedule.failed",
          entityType: "connector",
          entityId: source.code,
          details: { status: "failed", message, scheduler: "supabase_cron" }
        }).catch(() => void 0);
      }
    }
    const itemIndex = await indexPncpItems(160).catch((error) => ({ scanned: 0, indexed: 0, failures: 1, error: error instanceof Error ? error.message.slice(0, 150) : "unknown" }));
    runs.push({ source: "pncp-items", ...itemIndex });
    const notificationSummary = await dispatchDeadlineNotifications().catch(() => ({
      scannedEvents: 0,
      createdReminders: 0,
      createdSummaries: 0,
      failed: true
    }));
    return { status: "synchronized", scheduler: "supabase_cron", runs, notifications: notificationSummary };
  }
  const matched = enabledSources.find((source) => {
    const configuration = source.configuration && typeof source.configuration === "object" ? source.configuration : {};
    return source.enabled && (taskUid === "vercel-cron:compras.gov.br" ? source.code === "compras.gov.br" : configuration.scheduledTaskUid === taskUid);
  });
  if (!matched) {
    await getDb().insert(auditLogs).values({
      action: "source.schedule.unmatched",
      entityType: "scheduled_task",
      details: { callbackReceived: true, matched: false }
    });
    return { status: "no_source_registered_for_task" };
  }
  try {
    const result = await syncScheduledSource(matched);
    const notificationSummary = await dispatchDeadlineNotifications().catch(async (error) => {
      await getDb().insert(auditLogs).values({
        action: "notification.schedule.failed",
        entityType: "notification_job",
        details: { message: error instanceof Error ? error.message.slice(0, 240) : "Unknown error" }
      }).catch(() => void 0);
      return { scannedEvents: 0, createdReminders: 0, createdSummaries: 0, failed: true };
    });
    await getDb().insert(auditLogs).values({
      action: "source.schedule.completed",
      entityType: "connector",
      entityId: matched.code,
      details: {
        status: "synchronized",
        runId: result.runId,
        fetched: result.fetched,
        inserted: result.inserted,
        updated: result.updated,
        durationMs: result.durationMs,
        notifications: notificationSummary
      }
    });
    const coverage = matched.code === "pncp" ? { scope: "open_proposals_all_modalities", allPages: true } : {
      scope: "supplemental_recent_publications",
      windowDays: 7,
      modalityCodes: [3, 5, 8, 9, 11, 12, 14, 15, 20],
      allPages: true,
      historicalCoverage: false
    };
    return { status: "synchronized", coverage, ...result };
  } catch (error) {
    await getDb().insert(auditLogs).values({
      action: "source.schedule.failed",
      entityType: "connector",
      entityId: matched.code,
      details: {
        status: "failed",
        message: error instanceof Error ? error.message.slice(0, 240) : "Unknown error"
      }
    }).catch((logError) => console.error("[scheduled-audit] failed to persist callback error", logError instanceof Error ? logError.message : "unknown"));
    throw error;
  }
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
app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    await handleMercadoPagoWebhook(req);
    res.status(200).json({ received: true });
  } catch (error) {
    const status = Number(error?.statusCode) === 401 ? 401 : 500;
    if (status === 500) console.error("[mercadopago] webhook processing failed");
    res.status(status).json({ error: status === 401 ? "Invalid signature" : "Webhook processing failed" });
  }
});
app.all("/api/scheduled/sync", async (req, res) => {
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
