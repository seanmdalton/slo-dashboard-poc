CREATE TABLE IF NOT EXISTS "data_points" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"sli_id" varchar(255) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"good" integer DEFAULT 0 NOT NULL,
	"bad" integer DEFAULT 0 NOT NULL,
	"value" numeric(12, 3),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experiences" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journeys" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"experience_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slis" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"slo_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"objective_direction" varchar(10) NOT NULL,
	"target" numeric(10, 3) NOT NULL,
	"source" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slos" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"criticality" varchar(50) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"budgeting_window_days" integer DEFAULT 28 NOT NULL,
	"objective_percent" numeric(6, 3) NOT NULL,
	"error_budget_percent" numeric(6, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_points" ADD CONSTRAINT "data_points_sli_id_slis_id_fk" FOREIGN KEY ("sli_id") REFERENCES "public"."slis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "journeys" ADD CONSTRAINT "journeys_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slis" ADD CONSTRAINT "slis_slo_id_slos_id_fk" FOREIGN KEY ("slo_id") REFERENCES "public"."slos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slos" ADD CONSTRAINT "slos_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_points_sli_timestamp_idx" ON "data_points" USING btree ("sli_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_points_timestamp_idx" ON "data_points" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journeys_experience_idx" ON "journeys" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slis_slo_idx" ON "slis" USING btree ("slo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slis_type_idx" ON "slis" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slos_journey_idx" ON "slos" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slos_owner_idx" ON "slos" USING btree ("owner");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slos_criticality_idx" ON "slos" USING btree ("criticality");