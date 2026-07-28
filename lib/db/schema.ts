import { type SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  CareerGuidanceInput,
  CareerGuidanceOutput,
} from "@/lib/careerlens/schemas";

export const userStatus = pgEnum("user_status", ["ACTIVE", "DISABLED"]);
export const auditActorKind = pgEnum("audit_actor_kind", [
  "USER",
  "BUILTIN_SUPERADMIN",
  "SYSTEM",
]);
export const educationLevel = pgEnum("education_level", [
  "HIGH_SCHOOL",
  "UNDERGRADUATE",
  "GRADUATE",
]);
export const transcriptStage = pgEnum("transcript_stage", [
  "GRADE_10",
  "GRADE_11",
  "GRADE_12",
  "CUMULATIVE",
]);
export const chatMessageStatus = pgEnum("chat_message_status", [
  "pending",
  "streaming",
  "completed",
  "cancelled",
  "failed",
]);
export const agentRunStatus = pgEnum("agent_run_status", [
  "pending",
  "running",
  "completed",
  "cancelled",
  "failed",
]);
export const agentToolCallStatus = pgEnum("agent_tool_call_status", [
  "pending",
  "running",
  "completed",
  "cancelled",
  "failed",
]);
export const agentCitationSupportStatus = pgEnum(
  "agent_citation_support_status",
  ["supported", "unsupported"],
);

export type AgentRunUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AgentDataClass =
  | "public"
  | "personal_data"
  | "private_document";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    birthDate: date("birth_date", { mode: "string" }).notNull(),
    status: userStatus("status").default("ACTIVE").notNull(),
    sessionVersion: integer("session_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(lower(table.email)),
    check("users_session_version_positive", sql`${table.sessionVersion} > 0`),
    check(
      "users_birth_date_valid",
      sql`${table.birthDate} between date '1900-01-01' and current_date`,
    ),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    system: boolean("system").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("roles_key_unique").on(table.key)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("permissions_key_unique").on(table.key)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index("user_roles_role_id_idx").on(table.roleId),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    index("role_permissions_permission_id_idx").on(table.permissionId),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorKind: auditActorKind("actor_kind").notNull(),
    actorSubject: text("actor_subject").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_actor_idx").on(table.actorKind, table.actorSubject),
    index("audit_events_action_idx").on(table.action),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("oauth_accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    index("oauth_accounts_user_id_idx").on(table.userId),
  ],
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Chat"),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("chat_sessions_id_user_unique").on(table.id, table.userId),
    index("chat_sessions_user_id_idx").on(table.userId),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    model: text("model"),
    status: chatMessageStatus("status").default("completed").notNull(),
    dataClasses: jsonb("data_classes")
      .$type<AgentDataClass[]>()
      .default(sql`'["public"]'::jsonb`)
      .notNull(),
    clientRequestId: text("client_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("chat_messages_id_session_unique").on(table.id, table.sessionId),
    index("chat_messages_session_id_idx").on(
      table.sessionId,
      table.createdAt,
      table.id,
    ),
    uniqueIndex("chat_messages_session_client_request_unique")
      .on(table.sessionId, table.clientRequestId)
      .where(sql`${table.clientRequestId} is not null`),
    check(
      "chat_messages_data_classes_valid",
      sql`jsonb_typeof(${table.dataClasses}) = 'array'
        and jsonb_array_length(${table.dataClasses}) > 0
        and ${table.dataClasses} <@ '["public", "personal_data", "private_document"]'::jsonb`,
    ),
  ],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull(),
    clientRequestId: text("client_request_id").notNull(),
    model: text("model").notNull(),
    forceWeb: boolean("force_web").default(false).notNull(),
    status: agentRunStatus("status").default("pending").notNull(),
    userMessageId: uuid("user_message_id").notNull(),
    assistantMessageId: uuid("assistant_message_id").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    usage: jsonb("usage").$type<AgentRunUsage>(),
    dataClasses: jsonb("data_classes")
      .$type<AgentDataClass[]>()
      .default(sql`'["public"]'::jsonb`)
      .notNull(),
    toolCallCount: integer("tool_call_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_runs_user_client_request_unique").on(
      table.userId,
      table.clientRequestId,
    ),
    uniqueIndex("agent_runs_assistant_message_id_run_unique").on(
      table.assistantMessageId,
      table.id,
    ),
    uniqueIndex("agent_runs_session_active_unique")
      .on(table.sessionId)
      .where(sql`${table.status} in ('pending', 'running')`),
    uniqueIndex("agent_runs_user_message_unique").on(table.userMessageId),
    uniqueIndex("agent_runs_assistant_message_unique").on(
      table.assistantMessageId,
    ),
    index("agent_runs_user_created_at_idx").on(table.userId, table.createdAt),
    index("agent_runs_session_created_at_idx").on(
      table.sessionId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.sessionId, table.userId],
      foreignColumns: [chatSessions.id, chatSessions.userId],
      name: "agent_runs_session_user_chat_sessions_id_user_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userMessageId, table.sessionId],
      foreignColumns: [chatMessages.id, chatMessages.sessionId],
      name: "agent_runs_user_message_session_chat_messages_id_session_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.assistantMessageId, table.sessionId],
      foreignColumns: [chatMessages.id, chatMessages.sessionId],
      name: "agent_runs_assistant_message_session_chat_messages_id_session_fk",
    }).onDelete("cascade"),
    check(
      "agent_runs_distinct_messages",
      sql`${table.userMessageId} <> ${table.assistantMessageId}`,
    ),
    check(
      "agent_runs_tool_call_count_nonnegative",
      sql`${table.toolCallCount} >= 0`,
    ),
    check(
      "agent_runs_lifecycle_timestamps_valid",
      sql`(${table.status} = 'pending' and ${table.startedAt} is null and ${table.finishedAt} is null)
        or (${table.status} = 'running' and ${table.startedAt} is not null and ${table.finishedAt} is null)
        or (${table.status} in ('completed', 'cancelled', 'failed') and ${table.startedAt} is not null and ${table.finishedAt} is not null)`,
    ),
    check(
      "agent_runs_error_valid",
      sql`(${table.status} = 'failed' and ${table.errorCode} is not null and ${table.errorMessage} is not null)
        or (${table.status} <> 'failed' and ${table.errorCode} is null and ${table.errorMessage} is null)`,
    ),
    check(
      "agent_runs_data_classes_valid",
      sql`jsonb_typeof(${table.dataClasses}) = 'array'
        and jsonb_array_length(${table.dataClasses}) > 0
        and ${table.dataClasses} <@ '["public", "personal_data", "private_document"]'::jsonb`,
    ),
  ],
);

export const agentToolCalls = pgTable(
  "agent_tool_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    callId: text("call_id").notNull(),
    name: text("name").notNull(),
    arguments: jsonb("arguments").$type<unknown>().notNull(),
    result: jsonb("result").$type<unknown>(),
    status: agentToolCallStatus("status").default("pending").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("agent_tool_calls_run_call_unique").on(
      table.runId,
      table.callId,
    ),
    index("agent_tool_calls_run_id_idx").on(table.runId),
    check(
      "agent_tool_calls_lifecycle_timestamps_valid",
      sql`(${table.status} = 'pending' and ${table.startedAt} is null and ${table.finishedAt} is null)
        or (${table.status} = 'running' and ${table.startedAt} is not null and ${table.finishedAt} is null)
        or (${table.status} in ('completed', 'cancelled', 'failed') and ${table.startedAt} is not null and ${table.finishedAt} is not null)`,
    ),
    check(
      "agent_tool_calls_error_valid",
      sql`(${table.status} = 'failed' and ${table.errorMessage} is not null)
        or (${table.status} <> 'failed' and ${table.errorMessage} is null)`,
    ),
  ],
);

export const agentSources = pgTable(
  "agent_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    urlHash: text("url_hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_sources_id_run_unique").on(table.id, table.runId),
    uniqueIndex("agent_sources_run_source_key_unique").on(
      table.runId,
      table.sourceKey,
    ),
    uniqueIndex("agent_sources_run_url_hash_unique").on(
      table.runId,
      table.urlHash,
    ),
    index("agent_sources_run_id_idx").on(table.runId),
  ],
);

export const agentCitations = pgTable(
  "agent_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    messageId: uuid("message_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    quote: text("quote").notNull(),
    supportStatus: agentCitationSupportStatus("support_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_citations_message_ordinal_unique").on(
      table.messageId,
      table.ordinal,
    ),
    index("agent_citations_run_id_idx").on(table.runId),
    index("agent_citations_source_id_idx").on(table.sourceId, table.runId),
    foreignKey({
      columns: [table.sourceId, table.runId],
      foreignColumns: [agentSources.id, agentSources.runId],
      name: "agent_citations_source_run_agent_sources_id_run_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.messageId, table.runId],
      foreignColumns: [agentRuns.assistantMessageId, agentRuns.id],
      name: "agent_citations_message_run_agent_runs_assistant_message_id_run_fk",
    }).onDelete("cascade"),
    check("agent_citations_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
  ],
);

export type PersonalityScores = Record<
  "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P",
  number
>;

export const personalityTestResults = pgTable(
  "personality_test_results",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    resultType: text("result_type").notNull(),
    answers: jsonb("answers").$type<Array<"a" | "b">>().notNull(),
    scores: jsonb("scores").$type<PersonalityScores>().notNull(),
    testVersion: integer("test_version").default(1).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "personality_test_results_type_valid",
      sql`${table.resultType} in ('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP')`,
    ),
    check(
      "personality_test_results_version_positive",
      sql`${table.testVersion} > 0`,
    ),
    index("personality_test_results_completed_at_idx").on(table.completedAt),
  ],
);

export const educationRecords = pgTable(
  "education_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: educationLevel("level").notNull(),
    institutionName: text("institution_name").notNull(),
    fieldOfStudy: text("field_of_study"),
    startMonth: integer("start_month").notNull(),
    startYear: integer("start_year").notNull(),
    endMonth: integer("end_month").notNull(),
    endYear: integer("end_year").notNull(),
    scoreScale: integer("score_scale").default(10).notNull(),
    researchTitle: text("research_title"),
    researchDescription: text("research_description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("education_records_start_month_valid", sql`${table.startMonth} between 1 and 12`),
    check("education_records_end_month_valid", sql`${table.endMonth} between 1 and 12`),
    check("education_records_start_year_valid", sql`${table.startYear} >= 1900`),
    check("education_records_end_year_valid", sql`${table.endYear} >= 1900`),
    check("education_records_date_order_valid", sql`(${table.endYear}, ${table.endMonth}) >= (${table.startYear}, ${table.startMonth})`),
    check("education_records_score_scale_valid", sql`${table.scoreScale} in (4, 10)`),
    check("education_records_high_school_research_empty", sql`${table.level} <> 'HIGH_SCHOOL' or (${table.researchTitle} is null and ${table.researchDescription} is null)`),
    index("education_records_user_id_idx").on(table.userId),
    index("education_records_user_level_idx").on(table.userId, table.level),
  ],
);

export const transcriptEntries = pgTable(
  "transcript_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    educationRecordId: uuid("education_record_id")
      .notNull()
      .references(() => educationRecords.id, { onDelete: "cascade" }),
    stage: transcriptStage("stage").notNull(),
    subjectName: text("subject_name").notNull(),
    credits: doublePrecision("credits"),
    score: doublePrecision("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("transcript_entries_score_nonnegative", sql`${table.score} >= 0`),
    check("transcript_entries_credits_positive", sql`${table.credits} is null or ${table.credits} > 0`),
    uniqueIndex("transcript_entries_subject_stage_unique").on(
      table.educationRecordId,
      table.stage,
      lower(table.subjectName),
    ),
    index("transcript_entries_education_record_id_idx").on(table.educationRecordId),
  ],
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuedYear: integer("issued_year").notNull(),
    startMonth: integer("start_month").notNull(),
    startYear: integer("start_year").notNull(),
    endMonth: integer("end_month").notNull(),
    endYear: integer("end_year").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("certificates_issued_year_valid", sql`${table.issuedYear} >= 1900`),
    check("certificates_start_month_valid", sql`${table.startMonth} between 1 and 12`),
    check("certificates_end_month_valid", sql`${table.endMonth} between 1 and 12`),
    check("certificates_start_year_valid", sql`${table.startYear} >= 1900`),
    check("certificates_end_year_valid", sql`${table.endYear} >= 1900`),
    check("certificates_date_order_valid", sql`(${table.endYear}, ${table.endMonth}) >= (${table.startYear}, ${table.startMonth})`),
    index("certificates_user_id_idx").on(table.userId),
  ],
);

export const certificateAttachments = pgTable("certificate_attachments", {
  certificateId: uuid("certificate_id")
    .primaryKey()
    .references(() => certificates.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  check("certificate_attachments_byte_size_positive", sql`${table.byteSize} > 0`),
  check(
    "certificate_attachments_byte_size_max",
    sql`${table.byteSize} <= 5242880`,
  ),
  check(
    "certificate_attachments_mime_type_valid",
    sql`${table.mimeType} in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')`,
  ),
]);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    awardName: text("award_name"),
    year: integer("year").notNull(),
    startMonth: integer("start_month").notNull(),
    startYear: integer("start_year").notNull(),
    endMonth: integer("end_month").notNull(),
    endYear: integer("end_year").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("competitions_year_valid", sql`${table.year} >= 1900`),
    check("competitions_start_month_valid", sql`${table.startMonth} between 1 and 12`),
    check("competitions_end_month_valid", sql`${table.endMonth} between 1 and 12`),
    check("competitions_start_year_valid", sql`${table.startYear} >= 1900`),
    check("competitions_end_year_valid", sql`${table.endYear} >= 1900`),
    check("competitions_date_order_valid", sql`(${table.endYear}, ${table.endMonth}) >= (${table.startYear}, ${table.startMonth})`),
    index("competitions_user_id_idx").on(table.userId),
  ],
);

export const profileActivities = pgTable(
  "profile_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startMonth: integer("start_month").notNull(),
    startYear: integer("start_year").notNull(),
    endMonth: integer("end_month").notNull(),
    endYear: integer("end_year").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("profile_activities_start_month_valid", sql`${table.startMonth} between 1 and 12`),
    check("profile_activities_end_month_valid", sql`${table.endMonth} between 1 and 12`),
    check("profile_activities_start_year_valid", sql`${table.startYear} >= 1900`),
    check("profile_activities_end_year_valid", sql`${table.endYear} >= 1900`),
    check("profile_activities_date_order_valid", sql`(${table.endYear}, ${table.endMonth}) >= (${table.startYear}, ${table.startMonth})`),
    index("profile_activities_user_id_idx").on(table.userId),
  ],
);

export const workExperiences = pgTable(
  "work_experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workplaceName: text("workplace_name").notNull(),
    position: text("position"),
    startMonth: integer("start_month").notNull(),
    startYear: integer("start_year").notNull(),
    endMonth: integer("end_month"),
    endYear: integer("end_year"),
    isCurrent: boolean("is_current").default(false).notNull(),
    learnings: text("learnings"),
    skills: text("skills"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "work_experiences_start_month_valid",
      sql`${table.startMonth} between 1 and 12`,
    ),
    check(
      "work_experiences_end_month_valid",
      sql`${table.endMonth} is null or ${table.endMonth} between 1 and 12`,
    ),
    check("work_experiences_start_year_valid", sql`${table.startYear} >= 1900`),
    check(
      "work_experiences_end_year_valid",
      sql`${table.endYear} is null or ${table.endYear} >= 1900`,
    ),
    check(
      "work_experiences_end_date_consistent",
      sql`(${table.isCurrent} and ${table.endMonth} is null and ${table.endYear} is null) or (not ${table.isCurrent} and ${table.endMonth} is not null and ${table.endYear} is not null)`,
    ),
    check(
      "work_experiences_date_order_valid",
      sql`${table.isCurrent} or (${table.endYear}, ${table.endMonth}) >= (${table.startYear}, ${table.startMonth})`,
    ),
    index("work_experiences_user_id_idx").on(table.userId),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredCareerModel: text("preferred_career_model"),
  reuseLatestRoadmapData: boolean("reuse_latest_roadmap_data")
    .default(true)
    .notNull(),
  roadmapDataResetAt: timestamp("roadmap_data_reset_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const careerRoadmaps = pgTable(
  "career_roadmaps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    formValues: jsonb("form_values").$type<Record<string, unknown>>().notNull(),
    guidanceInput: jsonb("guidance_input").$type<CareerGuidanceInput>().notNull(),
    guidanceOutput: jsonb("guidance_output").$type<CareerGuidanceOutput>().notNull(),
    selectedRecommendationIndex: integer("selected_recommendation_index")
      .default(0)
      .notNull(),
    isFollowing: boolean("is_following").default(false).notNull(),
    followProgress: jsonb("follow_progress").$type<string[]>().default([]).notNull(),
    followedAt: timestamp("followed_at", { withTimezone: true }),
    stoppedFollowingAt: timestamp("stopped_following_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "career_roadmaps_selected_recommendation_valid",
      sql`${table.selectedRecommendationIndex} between 0 and 9`,
    ),
    index("career_roadmaps_user_updated_idx").on(table.userId, table.updatedAt),
    index("career_roadmaps_user_following_idx").on(table.userId, table.isFollowing),
  ],
);

export const journeyImports = pgTable(
  "journey_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roadmapId: uuid("roadmap_id").references(() => careerRoadmaps.id, {
      onDelete: "set null",
    }),
    directionTitle: text("direction_title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("journey_imports_user_created_idx").on(table.userId, table.createdAt),
    index("journey_imports_roadmap_idx").on(table.roadmapId),
  ],
);

export const journeyEntries = pgTable(
  "journey_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    importId: uuid("import_id").references(() => journeyImports.id, {
      onDelete: "set null",
    }),
    source: text("source").$type<"manual" | "roadmap" | "ai">().notNull(),
    category: text("category")
      .$type<"learning" | "experience" | "career" | "personal">()
      .notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    targetDate: date("target_date", { mode: "string" }).notNull(),
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceLabel: text("source_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "journey_entries_source_valid",
      sql`${table.source} in ('manual', 'roadmap', 'ai')`,
    ),
    check(
      "journey_entries_category_valid",
      sql`${table.category} in ('learning', 'experience', 'career', 'personal')`,
    ),
    check(
      "journey_entries_title_not_blank",
      sql`char_length(trim(${table.title})) > 0`,
    ),
    index("journey_entries_user_date_idx").on(table.userId, table.targetDate),
    index("journey_entries_import_idx").on(table.importId),
  ],
);

export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type AgentToolCall = typeof agentToolCalls.$inferSelect;
export type NewAgentToolCall = typeof agentToolCalls.$inferInsert;
export type AgentSourceRecord = typeof agentSources.$inferSelect;
export type NewAgentSourceRecord = typeof agentSources.$inferInsert;
export type AgentCitationRecord = typeof agentCitations.$inferSelect;
export type NewAgentCitationRecord = typeof agentCitations.$inferInsert;
export type JourneyEntry = typeof journeyEntries.$inferSelect;

export function lower(column: AnyPgColumn): SQL {
  return sql`lower(${column})`;
}
