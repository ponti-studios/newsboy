export const DEFAULT_GAME_SLUG = "reality";

export const GAME_CATALOG = [
  {
    slug: "reality",
    name: "Reality",
    genre: "celebrity",
    feedUrl: "https://realityblurred.com/realitytv/feed",
    feedLabel: "Reality Blurred",
  },
  {
    slug: "technology",
    name: "Tech News",
    genre: "technology",
    feedUrl: "https://techcrunch.com/feed/",
    feedLabel: "TechCrunch",
  },
  {
    slug: "page-six",
    name: "Page Six",
    genre: "celebrity",
    feedUrl: "https://pagesix.com/feed/",
    feedLabel: "Page Six",
  },
  {
    slug: "tmz",
    name: "TMZ",
    genre: "celebrity",
    feedUrl: "https://www.tmz.com/rss.xml",
    feedLabel: "TMZ",
  },
  {
    slug: "sports",
    name: "Sports News",
    genre: "sports",
    feedUrl: "https://www.cbssports.com/rss/headlines/",
    feedLabel: "CBS Sports",
  },
] as const;

/**
 * One emoji per topic, shared by the share text and the week-streak grid so
 * a topic reads the same everywhere. Keyed by slug rather than derived from
 * GAME_CATALOG because history rows can reference retired topics (e.g.
 * "markets", "culture") that are no longer in the active catalog.
 */
export const TOPIC_EMOJI: Readonly<Record<string, string>> = {
  reality: "🩷",
  technology: "💻",
  "page-six": "🗞️",
  tmz: "📸",
  sports: "🏆",
  markets: "📈",
  culture: "🎭",
};

/** Shown when a topic slug isn't in the map (e.g. a topic created ad hoc). */
export const DEFAULT_TOPIC_EMOJI = "📰";

export function getTopicEmoji(slug: string | undefined): string {
  if (slug && Object.hasOwn(TOPIC_EMOJI, slug)) {
    return TOPIC_EMOJI[slug];
  }
  return DEFAULT_TOPIC_EMOJI;
}
