ALTER TABLE "labs"."search_documents" ADD COLUMN "source_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."search_documents" ADD COLUMN "published_at" timestamp NOT NULL;