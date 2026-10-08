CREATE TABLE IF NOT EXISTS "incidents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"park_id" uuid NOT NULL,
	"reporter_id" uuid,
	"type" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'NEW' NOT NULL,
	"description" text NOT NULL,
	"location" geometry(Point,4326),
	"photo_url" text,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"incident_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"notes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_park_id_parks_id_fk" FOREIGN KEY ("park_id") REFERENCES "public"."parks"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reporter_id_auth_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incident_reviews" ADD CONSTRAINT "incident_reviews_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incident_reviews" ADD CONSTRAINT "incident_reviews_reviewer_id_auth_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."auth_users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_park_status_idx" ON "incidents" USING btree ("park_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_reported_at_idx" ON "incidents" USING btree ("reported_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_reviews_incident_idx" ON "incident_reviews" USING btree ("incident_id");
