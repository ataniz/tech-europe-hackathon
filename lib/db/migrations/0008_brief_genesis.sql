CREATE TABLE IF NOT EXISTS "Asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"type" varchar NOT NULL,
	"url" text NOT NULL,
	"prompt" text,
	"filename" text,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "parentChatId" uuid;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "chatType" varchar DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "status" varchar DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "returnValue" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Asset" ADD CONSTRAINT "Asset_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_parentChatId_Chat_id_fk" FOREIGN KEY ("parentChatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
