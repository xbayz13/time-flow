CREATE TABLE "activity_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_id" uuid,
	"action" varchar(10) NOT NULL,
	"source" varchar(10) NOT NULL,
	"payload_before" text,
	"payload_after" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_audit_logs" ADD CONSTRAINT "activity_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;