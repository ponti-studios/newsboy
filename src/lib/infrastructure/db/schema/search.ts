import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  serial,
  text,
  timestamp,
  vector,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { labs } from "./base";

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value;
  },
});

export const searchDocuments = labs.table(
  "search_documents",
  {
    id: serial("id").primaryKey(),
    kind: text("kind", { enum: ["movie", "tv"] }).notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    category: text("category").notNull(),
    location: text("location").notNull(),
    year: integer("year").notNull(),
    sourceUrl: text("source_url").notNull(),
    publishedAt: timestamp("published_at").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    featured: boolean("featured").notNull().default(false),
    popularity: integer("popularity").notNull().default(0),
    searchText: text("search_text").notNull(),
    searchVector: tsvector("search_vector")
      .notNull()
      .default(sql`''::tsvector`),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("search_documents_kind_idx").on(table.kind),
    index("search_documents_category_idx").on(table.category),
    index("search_documents_year_idx").on(table.year),
    index("search_documents_featured_idx").on(table.featured),
    uniqueIndex("search_documents_source_url_idx").on(table.sourceUrl),
    index("search_documents_search_vector_idx").using("gin", table.searchVector),
  ],
);

export type SearchDocumentKind = "movie" | "tv";
export type SearchDocument = typeof searchDocuments.$inferSelect;
export type NewSearchDocument = typeof searchDocuments.$inferInsert;
