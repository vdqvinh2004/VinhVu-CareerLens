CREATE TABLE "journey_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"import_id" uuid,
	"source" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"target_date" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"source_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_entries_source_valid" CHECK ("journey_entries"."source" in ('manual', 'roadmap', 'ai')),
	CONSTRAINT "journey_entries_category_valid" CHECK ("journey_entries"."category" in ('learning', 'experience', 'career', 'personal')),
	CONSTRAINT "journey_entries_title_not_blank" CHECK (char_length(trim("journey_entries"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "journey_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"roadmap_id" uuid,
	"direction_title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "career_roadmaps" ADD COLUMN "is_following" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "career_roadmaps" ADD COLUMN "follow_progress" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "career_roadmaps" ADD COLUMN "followed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "career_roadmaps" ADD COLUMN "stopped_following_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "journey_entries" ADD CONSTRAINT "journey_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_entries" ADD CONSTRAINT "journey_entries_import_id_journey_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."journey_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_imports" ADD CONSTRAINT "journey_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_imports" ADD CONSTRAINT "journey_imports_roadmap_id_career_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."career_roadmaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journey_entries_user_date_idx" ON "journey_entries" USING btree ("user_id","target_date");--> statement-breakpoint
CREATE INDEX "journey_entries_import_idx" ON "journey_entries" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "journey_imports_user_created_idx" ON "journey_imports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "journey_imports_roadmap_idx" ON "journey_imports" USING btree ("roadmap_id");--> statement-breakpoint
CREATE INDEX "career_roadmaps_user_following_idx" ON "career_roadmaps" USING btree ("user_id","is_following");