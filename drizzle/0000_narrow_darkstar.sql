CREATE TYPE "public"."agent_citation_support_status" AS ENUM('supported', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('pending', 'running', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."agent_tool_call_status" AS ENUM('pending', 'running', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_kind" AS ENUM('USER', 'BUILTIN_SUPERADMIN', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."chat_message_status" AS ENUM('pending', 'streaming', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('HIGH_SCHOOL', 'UNDERGRADUATE', 'GRADUATE');--> statement-breakpoint
CREATE TYPE "public"."transcript_stage" AS ENUM('GRADE_10', 'GRADE_11', 'GRADE_12', 'CUMULATIVE');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TABLE "agent_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"quote" text NOT NULL,
	"support_status" "agent_citation_support_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_citations_ordinal_nonnegative" CHECK ("agent_citations"."ordinal" >= 0)
);--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"client_request_id" text NOT NULL,
	"model" text NOT NULL,
	"force_web" boolean DEFAULT false NOT NULL,
	"status" "agent_run_status" DEFAULT 'pending' NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid NOT NULL,
	"error_code" text,
	"error_message" text,
	"usage" jsonb,
	"data_classes" jsonb DEFAULT '["public"]'::jsonb NOT NULL,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_distinct_messages" CHECK ("agent_runs"."user_message_id" <> "agent_runs"."assistant_message_id"),
	CONSTRAINT "agent_runs_tool_call_count_nonnegative" CHECK ("agent_runs"."tool_call_count" >= 0),
	CONSTRAINT "agent_runs_lifecycle_timestamps_valid" CHECK (("agent_runs"."status" = 'pending' and "agent_runs"."started_at" is null and "agent_runs"."finished_at" is null)
        or ("agent_runs"."status" = 'running' and "agent_runs"."started_at" is not null and "agent_runs"."finished_at" is null)
        or ("agent_runs"."status" in ('completed', 'cancelled', 'failed') and "agent_runs"."started_at" is not null and "agent_runs"."finished_at" is not null)),
	CONSTRAINT "agent_runs_error_valid" CHECK (("agent_runs"."status" = 'failed' and "agent_runs"."error_code" is not null and "agent_runs"."error_message" is not null)
        or ("agent_runs"."status" <> 'failed' and "agent_runs"."error_code" is null and "agent_runs"."error_message" is null)),
	CONSTRAINT "agent_runs_data_classes_valid" CHECK (jsonb_typeof("agent_runs"."data_classes") = 'array'
        and jsonb_array_length("agent_runs"."data_classes") > 0
        and "agent_runs"."data_classes" <@ '["public", "personal_data", "private_document"]'::jsonb)
);--> statement-breakpoint
CREATE TABLE "agent_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"accessed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "agent_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"call_id" text NOT NULL,
	"name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"status" "agent_tool_call_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "agent_tool_calls_lifecycle_timestamps_valid" CHECK (("agent_tool_calls"."status" = 'pending' and "agent_tool_calls"."started_at" is null and "agent_tool_calls"."finished_at" is null)
        or ("agent_tool_calls"."status" = 'running' and "agent_tool_calls"."started_at" is not null and "agent_tool_calls"."finished_at" is null)
        or ("agent_tool_calls"."status" in ('completed', 'cancelled', 'failed') and "agent_tool_calls"."started_at" is not null and "agent_tool_calls"."finished_at" is not null)),
	CONSTRAINT "agent_tool_calls_error_valid" CHECK (("agent_tool_calls"."status" = 'failed' and "agent_tool_calls"."error_message" is not null)
        or ("agent_tool_calls"."status" <> 'failed' and "agent_tool_calls"."error_message" is null))
);--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_kind" "audit_actor_kind" NOT NULL,
	"actor_subject" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "career_roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"form_values" jsonb NOT NULL,
	"guidance_input" jsonb NOT NULL,
	"guidance_output" jsonb NOT NULL,
	"selected_recommendation_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_roadmaps_selected_recommendation_valid" CHECK ("career_roadmaps"."selected_recommendation_index" between 0 and 9)
);--> statement-breakpoint
CREATE TABLE "certificate_attachments" (
	"certificate_id" uuid PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_attachments_byte_size_positive" CHECK ("certificate_attachments"."byte_size" > 0),
	CONSTRAINT "certificate_attachments_byte_size_max" CHECK ("certificate_attachments"."byte_size" <= 5242880),
	CONSTRAINT "certificate_attachments_mime_type_valid" CHECK ("certificate_attachments"."mime_type" in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'))
);--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issued_year" integer NOT NULL,
	"start_month" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_month" integer NOT NULL,
	"end_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_issued_year_valid" CHECK ("certificates"."issued_year" >= 1900),
	CONSTRAINT "certificates_start_month_valid" CHECK ("certificates"."start_month" between 1 and 12),
	CONSTRAINT "certificates_end_month_valid" CHECK ("certificates"."end_month" between 1 and 12),
	CONSTRAINT "certificates_start_year_valid" CHECK ("certificates"."start_year" >= 1900),
	CONSTRAINT "certificates_end_year_valid" CHECK ("certificates"."end_year" >= 1900),
	CONSTRAINT "certificates_date_order_valid" CHECK (("certificates"."end_year", "certificates"."end_month") >= ("certificates"."start_year", "certificates"."start_month"))
);--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"status" "chat_message_status" DEFAULT 'completed' NOT NULL,
	"data_classes" jsonb DEFAULT '["public"]'::jsonb NOT NULL,
	"client_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_data_classes_valid" CHECK (jsonb_typeof("chat_messages"."data_classes") = 'array'
        and jsonb_array_length("chat_messages"."data_classes") > 0
        and "chat_messages"."data_classes" <@ '["public", "personal_data", "private_document"]'::jsonb)
);--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"award_name" text,
	"year" integer NOT NULL,
	"start_month" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_month" integer NOT NULL,
	"end_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_year_valid" CHECK ("competitions"."year" >= 1900),
	CONSTRAINT "competitions_start_month_valid" CHECK ("competitions"."start_month" between 1 and 12),
	CONSTRAINT "competitions_end_month_valid" CHECK ("competitions"."end_month" between 1 and 12),
	CONSTRAINT "competitions_start_year_valid" CHECK ("competitions"."start_year" >= 1900),
	CONSTRAINT "competitions_end_year_valid" CHECK ("competitions"."end_year" >= 1900),
	CONSTRAINT "competitions_date_order_valid" CHECK (("competitions"."end_year", "competitions"."end_month") >= ("competitions"."start_year", "competitions"."start_month"))
);--> statement-breakpoint
CREATE TABLE "education_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level" "education_level" NOT NULL,
	"institution_name" text NOT NULL,
	"field_of_study" text,
	"start_month" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_month" integer NOT NULL,
	"end_year" integer NOT NULL,
	"score_scale" integer DEFAULT 10 NOT NULL,
	"research_title" text,
	"research_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "education_records_start_month_valid" CHECK ("education_records"."start_month" between 1 and 12),
	CONSTRAINT "education_records_end_month_valid" CHECK ("education_records"."end_month" between 1 and 12),
	CONSTRAINT "education_records_start_year_valid" CHECK ("education_records"."start_year" >= 1900),
	CONSTRAINT "education_records_end_year_valid" CHECK ("education_records"."end_year" >= 1900),
	CONSTRAINT "education_records_date_order_valid" CHECK (("education_records"."end_year", "education_records"."end_month") >= ("education_records"."start_year", "education_records"."start_month")),
	CONSTRAINT "education_records_score_scale_valid" CHECK ("education_records"."score_scale" in (4, 10)),
	CONSTRAINT "education_records_high_school_research_empty" CHECK ("education_records"."level" <> 'HIGH_SCHOOL' or ("education_records"."research_title" is null and "education_records"."research_description" is null))
);--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "personality_test_results" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"result_type" text NOT NULL,
	"answers" jsonb NOT NULL,
	"scores" jsonb NOT NULL,
	"test_version" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personality_test_results_type_valid" CHECK ("personality_test_results"."result_type" in ('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP')),
	CONSTRAINT "personality_test_results_version_positive" CHECK ("personality_test_results"."test_version" > 0)
);--> statement-breakpoint
CREATE TABLE "profile_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_month" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_month" integer NOT NULL,
	"end_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_activities_start_month_valid" CHECK ("profile_activities"."start_month" between 1 and 12),
	CONSTRAINT "profile_activities_end_month_valid" CHECK ("profile_activities"."end_month" between 1 and 12),
	CONSTRAINT "profile_activities_start_year_valid" CHECK ("profile_activities"."start_year" >= 1900),
	CONSTRAINT "profile_activities_end_year_valid" CHECK ("profile_activities"."end_year" >= 1900),
	CONSTRAINT "profile_activities_date_order_valid" CHECK (("profile_activities"."end_year", "profile_activities"."end_month") >= ("profile_activities"."start_year", "profile_activities"."start_month"))
);--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "transcript_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"education_record_id" uuid NOT NULL,
	"stage" "transcript_stage" NOT NULL,
	"subject_name" text NOT NULL,
	"credits" double precision,
	"score" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_entries_score_nonnegative" CHECK ("transcript_entries"."score" >= 0),
	CONSTRAINT "transcript_entries_credits_positive" CHECK ("transcript_entries"."credits" is null or "transcript_entries"."credits" > 0)
);--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_career_model" text,
	"reuse_latest_roadmap_data" boolean DEFAULT true NOT NULL,
	"roadmap_data_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"birth_date" date NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_session_version_positive" CHECK ("users"."session_version" > 0),
	CONSTRAINT "users_birth_date_valid" CHECK ("users"."birth_date" between date '1900-01-01' and current_date)
);--> statement-breakpoint
CREATE TABLE "work_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workplace_name" text NOT NULL,
	"position" text,
	"start_month" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_month" integer,
	"end_year" integer,
	"is_current" boolean DEFAULT false NOT NULL,
	"learnings" text,
	"skills" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_experiences_start_month_valid" CHECK ("work_experiences"."start_month" between 1 and 12),
	CONSTRAINT "work_experiences_end_month_valid" CHECK ("work_experiences"."end_month" is null or "work_experiences"."end_month" between 1 and 12),
	CONSTRAINT "work_experiences_start_year_valid" CHECK ("work_experiences"."start_year" >= 1900),
	CONSTRAINT "work_experiences_end_year_valid" CHECK ("work_experiences"."end_year" is null or "work_experiences"."end_year" >= 1900),
	CONSTRAINT "work_experiences_end_date_consistent" CHECK (("work_experiences"."is_current" and "work_experiences"."end_month" is null and "work_experiences"."end_year" is null) or (not "work_experiences"."is_current" and "work_experiences"."end_month" is not null and "work_experiences"."end_year" is not null)),
	CONSTRAINT "work_experiences_date_order_valid" CHECK ("work_experiences"."is_current" or ("work_experiences"."end_year", "work_experiences"."end_month") >= ("work_experiences"."start_year", "work_experiences"."start_month"))
);--> statement-breakpoint
INSERT INTO "permissions" ("key", "description") VALUES
	('dashboard.access', 'Access the dashboard'),
	('accounts.read', 'Read account information'),
	('accounts.roles.assign', 'Assign roles to accounts'),
	('roles.read', 'Read roles and permissions'),
	('roles.manage', 'Create and update roles');--> statement-breakpoint
INSERT INTO "roles" ("key", "name", "description", "system") VALUES
	('USER', 'User', 'Default role assigned to public accounts', true);--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT "roles"."id", "permissions"."id"
FROM "roles", "permissions"
WHERE "roles"."key" = 'USER' AND "permissions"."key" = 'dashboard.access';
CREATE UNIQUE INDEX "agent_citations_message_ordinal_unique" ON "agent_citations" USING btree ("message_id","ordinal");--> statement-breakpoint
CREATE INDEX "agent_citations_run_id_idx" ON "agent_citations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_citations_source_id_idx" ON "agent_citations" USING btree ("source_id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_user_client_request_unique" ON "agent_runs" USING btree ("user_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_assistant_message_id_run_unique" ON "agent_runs" USING btree ("assistant_message_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_session_active_unique" ON "agent_runs" USING btree ("session_id") WHERE "agent_runs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_user_message_unique" ON "agent_runs" USING btree ("user_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_assistant_message_unique" ON "agent_runs" USING btree ("assistant_message_id");--> statement-breakpoint
CREATE INDEX "agent_runs_user_created_at_idx" ON "agent_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_session_created_at_idx" ON "agent_runs" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_id_run_unique" ON "agent_sources" USING btree ("id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_run_source_key_unique" ON "agent_sources" USING btree ("run_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_run_url_hash_unique" ON "agent_sources" USING btree ("run_id","url_hash");--> statement-breakpoint
CREATE INDEX "agent_sources_run_id_idx" ON "agent_sources" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tool_calls_run_call_unique" ON "agent_tool_calls" USING btree ("run_id","call_id");--> statement-breakpoint
CREATE INDEX "agent_tool_calls_run_id_idx" ON "agent_tool_calls" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_kind","actor_subject");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "career_roadmaps_user_updated_idx" ON "career_roadmaps" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "certificates_user_id_idx" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_id_session_unique" ON "chat_messages" USING btree ("id","session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_session_client_request_unique" ON "chat_messages" USING btree ("session_id","client_request_id") WHERE "chat_messages"."client_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_id_user_unique" ON "chat_sessions" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "competitions_user_id_idx" ON "competitions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "education_records_user_id_idx" ON "education_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "education_records_user_level_idx" ON "education_records" USING btree ("user_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_account_unique" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "personality_test_results_completed_at_idx" ON "personality_test_results" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "profile_activities_user_id_idx" ON "profile_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_unique" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_entries_subject_stage_unique" ON "transcript_entries" USING btree ("education_record_id","stage",lower("subject_name"));--> statement-breakpoint
CREATE INDEX "transcript_entries_education_record_id_idx" ON "transcript_entries" USING btree ("education_record_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "work_experiences_user_id_idx" ON "work_experiences" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "agent_citations" ADD CONSTRAINT "agent_citations_source_run_agent_sources_id_run_fk" FOREIGN KEY ("source_id","run_id") REFERENCES "public"."agent_sources"("id","run_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_citations" ADD CONSTRAINT "agent_citations_message_run_agent_runs_assistant_message_id_run_fk" FOREIGN KEY ("message_id","run_id") REFERENCES "public"."agent_runs"("assistant_message_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_user_chat_sessions_id_user_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "public"."chat_sessions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_message_session_chat_messages_id_session_fk" FOREIGN KEY ("user_message_id","session_id") REFERENCES "public"."chat_messages"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_assistant_message_session_chat_messages_id_session_fk" FOREIGN KEY ("assistant_message_id","session_id") REFERENCES "public"."chat_messages"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sources" ADD CONSTRAINT "agent_sources_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_roadmaps" ADD CONSTRAINT "career_roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_attachments" ADD CONSTRAINT "certificate_attachments_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_test_results" ADD CONSTRAINT "personality_test_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_activities" ADD CONSTRAINT "profile_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_entries" ADD CONSTRAINT "transcript_entries_education_record_id_education_records_id_fk" FOREIGN KEY ("education_record_id") REFERENCES "public"."education_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
