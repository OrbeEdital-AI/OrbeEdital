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
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "superadmin",
  "admin",
  "source_operator",
  "support",
  "finance",
]);

export const pipelineStatusEnum = pgEnum("pipeline_status", [
  "new",
  "analysis",
  "interesting",
  "docs",
  "proposal_sent",
  "participating",
  "won",
  "lost",
  "discarded",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable(
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
    ...timestamps,
  },
  table => [uniqueIndex("users_email_unique").on(table.email), index("users_role_idx").on(table.role)],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalName: text("legal_name").notNull(),
    cnpj: varchar("cnpj", { length: 18 }),
    state: varchar("state", { length: 2 }),
    municipality: text("municipality"),
    primarySegment: text("primary_segment"),
    ...timestamps,
  },
  table => [uniqueIndex("companies_cnpj_unique").on(table.cnpj)],
);

export const companyMembers = pgTable(
  "company_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    memberRole: text("member_role").default("owner").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [uniqueIndex("company_members_company_user_unique").on(table.companyId, table.userId)],
);

export const companyProfiles = pgTable(
  "company_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().unique().references(() => companies.id, { onDelete: "cascade" }),
    segments: jsonb("segments").$type<string[]>().notNull().default([]),
    products: jsonb("products").$type<string[]>().notNull().default([]),
    services: jsonb("services").$type<string[]>().notNull().default([]),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    servedStates: jsonb("served_states").$type<string[]>().notNull().default([]),
    servedMunicipalities: jsonb("served_municipalities").$type<string[]>().notNull().default([]),
    minimumValue: numeric("minimum_value", { precision: 16, scale: 2 }),
    maximumValue: numeric("maximum_value", { precision: 16, scale: 2 }),
    catmatCodes: jsonb("catmat_codes").$type<string[]>().notNull().default([]),
    catserCodes: jsonb("catser_codes").$type<string[]>().notNull().default([]),
    notificationPreferences: jsonb("notification_preferences").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("auth_sessions_user_idx").on(table.userId), index("auth_sessions_expiry_idx").on(table.expiresAt)],
);

export const connectors = pgTable(
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
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  table => [index("connectors_status_idx").on(table.status, table.enabled)],
);

export const syncRuns = pgTable(
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
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  table => [index("sync_runs_connector_started_idx").on(table.connectorId, table.startedAt)],
);

export const opportunities = pgTable(
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
    documents: jsonb("documents").$type<Array<Record<string, unknown>>>().notNull().default([]),
    itemCount: integer("item_count"),
    lastSourceUpdateAt: timestamp("last_source_update_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  table => [
    uniqueIndex("opportunities_source_key_unique").on(table.connectorId, table.sourceKey),
    uniqueIndex("opportunities_control_number_unique").on(table.controlNumber),
    index("opportunities_state_status_idx").on(table.state, table.status),
    index("opportunities_publication_idx").on(table.publicationDate),
    index("opportunities_deadline_idx").on(table.proposalDeadline),
    index("opportunities_agency_idx").on(table.agencyName),
    index("opportunities_modality_idx").on(table.modality),
  ],
);

export const opportunityItems = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("opportunity_items_opportunity_idx").on(table.opportunityId), index("opportunity_items_catalog_idx").on(table.catalogCode)],
);

export const opportunityHistory = pgTable(
  "opportunity_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    summary: text("summary"),
    previousValues: jsonb("previous_values").$type<Record<string, unknown>>(),
    newValues: jsonb("new_values").$type<Record<string, unknown>>(),
    happenedAt: timestamp("happened_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("opportunity_history_opportunity_idx").on(table.opportunityId, table.happenedAt)],
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [uniqueIndex("favorites_user_opportunity_unique").on(table.userId, table.opportunityId), index("favorites_user_idx").on(table.userId)],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("saved_searches_user_idx").on(table.userId)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull().default({}),
    channels: jsonb("channels").$type<string[]>().notNull().default(["in_app"]),
    frequency: text("frequency").default("daily").notNull(),
    active: boolean("active").default(true).notNull(),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    ...timestamps,
  },
  table => [index("alerts_user_active_idx").on(table.userId, table.active)],
);

export const notifications = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("notifications_user_created_idx").on(table.userId, table.createdAt)],
);

export const followedOpportunities = pgTable(
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
    ...timestamps,
  },
  table => [uniqueIndex("followed_user_opportunity_unique").on(table.userId, table.opportunityId), index("followed_opportunities_company_idx").on(table.companyId)],
);

export const opportunityActivities = pgTable(
  "opportunity_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followedOpportunityId: uuid("followed_opportunity_id").notNull().references(() => followedOpportunities.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("opportunity_activities_followed_idx").on(table.followedOpportunityId, table.createdAt)],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 80 }).notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    monthlyPriceCents: integer("monthly_price_cents").default(0).notNull(),
    annualPriceCents: integer("annual_price_cents").default(0).notNull(),
    limits: jsonb("limits").$type<Record<string, number | boolean>>().notNull().default({}),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
);

export const planUsage = pgTable(
  "plan_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    searchesCount: integer("searches_count").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [uniqueIndex("plan_usage_company_period_unique").on(table.companyId, table.periodStart)],
);

export const subscriptions = pgTable(
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
    ...timestamps,
  },
  table => [index("subscriptions_company_status_idx").on(table.companyId, table.status)],
);

export const payments = pgTable(
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
    ...timestamps,
  },
  table => [index("payments_company_created_idx").on(table.companyId, table.createdAt), uniqueIndex("payments_provider_id_unique").on(table.provider, table.providerPaymentId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt), index("audit_logs_entity_idx").on(table.entityType, table.entityId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SafeUser = Omit<User, "passwordHash">;
export type Company = typeof companies.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Connector = typeof connectors.$inferSelect;

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("email_verifications_token_hash_unique").on(table.tokenHash), index("email_verifications_user_idx").on(table.userId)]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash), index("password_reset_tokens_user_idx").on(table.userId)]);
