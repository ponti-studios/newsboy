const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
};

function fromCodePoint(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return "";
  return String.fromCodePoint(code);
}

/** Decode numeric and common named HTML entities from RSS/HTML fragments. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => fromCodePoint(Number.parseInt(dec, 10)))
    .replace(
      /&([a-zA-Z]+);/g,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );
}

/** Normalize feed text before it becomes model input or puzzle copy. */
export function sanitizeFeedText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";

  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(
        (codePoint >= 0 && codePoint <= 8) ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        codePoint === 127
      );
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

export const MAX_FEED_TITLE_LENGTH = 240;
export const MAX_FEED_DESCRIPTION_LENGTH = 4_000;
export const MAX_ARTICLE_TEXT_LENGTH = 24_000;
