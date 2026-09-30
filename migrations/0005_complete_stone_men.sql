ALTER TABLE "labs"."search_documents" ALTER COLUMN "embedding" DROP DEFAULT;
ALTER TABLE "labs"."search_documents" ALTER COLUMN "embedding" SET DATA TYPE vector(3072) USING "embedding"::text::vector(3072);
