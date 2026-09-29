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
  {
    slug: "politics",
    name: "Politics",
    genre: "politics",
    feedUrl: "https://feeds.bbci.co.uk/news/politics/rss.xml",
    feedLabel: "BBC Politics",
    deferActivationUntilCurrentPuzzle: true,
  },
  {
    slug: "business",
    name: "Business",
    genre: "business",
    feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
    feedLabel: "BBC Business",
    deferActivationUntilCurrentPuzzle: true,
  },
  {
    slug: "science",
    name: "Science",
    genre: "science",
    feedUrl: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    feedLabel: "BBC Science & Environment",
    deferActivationUntilCurrentPuzzle: true,
  },
  {
    slug: "world",
    name: "World News",
    genre: "world",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    feedLabel: "BBC World",
    deferActivationUntilCurrentPuzzle: true,
  },
  {
    slug: "health",
    name: "Health",
    genre: "health",
    feedUrl: "https://feeds.bbci.co.uk/news/health/rss.xml",
    feedLabel: "BBC Health",
    deferActivationUntilCurrentPuzzle: true,
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
  politics: "🏛️",
  business: "💼",
  science: "🔬",
  world: "🌍",
  health: "🩺",
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
