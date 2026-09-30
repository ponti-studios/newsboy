ALTER TABLE "labs"."search_documents" ADD COLUMN "search_vector" "tsvector" DEFAULT ''::tsvector NOT NULL;--> statement-breakpoint
ALTER TABLE "labs"."search_documents" ADD COLUMN "embedding" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "search_documents_search_vector_idx" ON "labs"."search_documents" USING gin ("search_vector");