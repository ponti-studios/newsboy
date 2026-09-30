CREATE TABLE "labs"."search_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"category" text NOT NULL,
	"location" text NOT NULL,
	"year" integer NOT NULL,
	"tags" jsonb NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"search_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "search_documents_kind_idx" ON "labs"."search_documents" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "search_documents_category_idx" ON "labs"."search_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "search_documents_year_idx" ON "labs"."search_documents" USING btree ("year");--> statement-breakpoint
CREATE INDEX "search_documents_featured_idx" ON "labs"."search_documents" USING btree ("featured");