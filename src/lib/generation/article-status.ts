export const articleStatusValues = ["pending", "used", "rejected", "expired"] as const;
export type ArticleStatus = (typeof articleStatusValues)[number];

export function isArticleStatus(value: string): value is ArticleStatus {
  return (articleStatusValues as readonly string[]).includes(value);
}
