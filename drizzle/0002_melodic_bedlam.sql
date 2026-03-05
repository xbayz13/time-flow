ALTER TABLE "users" ADD COLUMN "ai_access_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_access_expires_at" timestamp with time zone;