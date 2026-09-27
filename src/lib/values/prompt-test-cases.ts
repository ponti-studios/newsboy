import type { FeedItem } from "../generation/types";

export interface PromptTestFixture {
  id: string;
  genre: string;
  sourceDomains: string[];
  expectedAnswers: string[];
  /** Known attractive-but-wrong answers the generator must not select. */
  forbiddenAnswers?: string[];
  feedItems: FeedItem[];
}

const item = (source: string, title: string, description: string): FeedItem => ({
  title,
  link: `https://${source}/test/${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
  pubDate: "2026-08-12T00:00:00Z",
  description,
});

export const PROMPT_TEST_CASES: PromptTestFixture[] = [
  {
    id: "tech-product-launch",
    genre: "technology",
    sourceDomains: ["techcrunch.com"],
    expectedAnswers: ["HINGE", "WATCH"],
    feedItems: [
      item(
        "techcrunch.com",
        "New foldable phone uses a titanium hinge to improve durability",
        "The company says its redesigned hinge reduces the crease and keeps the display flat when opened.",
      ),
    ],
  },
  {
    id: "celebrity-divorce",
    genre: "celebrity",
    sourceDomains: ["pagesix.com"],
    expectedAnswers: ["SPLIT", "SUED"],
    feedItems: [
      item(
        "pagesix.com",
        "Comedian addresses painful divorce from longtime spouse",
        "The comedian said the marriage ended after nearly two decades and described the separation as difficult.",
      ),
    ],
  },
  {
    id: "sports-crowd-reaction",
    genre: "sports",
    sourceDomains: ["cbssports.com"],
    expectedAnswers: ["BOOED", "CHEER"],
    feedItems: [
      item(
        "cbssports.com",
        "Fans boo coach as players defend her after a difficult loss",
        "The crowd voiced its disapproval during the game, while the team's leading players publicly backed the coach.",
      ),
    ],
  },
  {
    id: "cbs-sports-penalty-save",
    genre: "sports",
    sourceDomains: ["cbssports.com"],
    // BLOCK and SAVED both directly name the goalkeeper's decisive action;
    // the benchmark should accept either rather than require one synonym.
    expectedAnswers: ["BLOCK", "SAVED", "TRADE"],
    forbiddenAnswers: ["PENAL", "DEPTH"],
    feedItems: [
      {
        title: "Rookie goalkeeper preserves club's lead with final-minute penalty save",
        link: "https://www.cbssports.com/soccer/news/rookie-goalkeeper-preserves-clubs-lead/",
        pubDate: "2026-08-12T00:00:00Z",
        description:
          "The 19-year-old goalkeeper stopped a penalty in stoppage time to secure a narrow victory.",
        articleText:
          "With the score tied late in the match, the rookie goalkeeper held position and denied the opposing striker from the spot. The stop preserved the club's one-goal advantage and sealed its first win of the season.",
      },
    ],
  },
  {
    id: "food-restaurant-closure",
    genre: "food",
    sourceDomains: ["eater.com"],
    expectedAnswers: ["CLOSE", "LEASE", "CHEF"],
    feedItems: [
      item(
        "eater.com",
        "Beloved neighborhood restaurant will close after 18 years",
        "The owners cited rising rent and thanked regulars; the chef plans to announce a new project later this year.",
      ),
    ],
  },
  {
    id: "shopping-guide-vs-incidental-object",
    genre: "commerce",
    sourceDomains: ["tmz.com"],
    expectedAnswers: ["GIFTS"],
    forbiddenAnswers: ["MUGGY"],
    feedItems: [
      item(
        "tmz.com",
        "Workstation essentials inspired by Steve Carell and The Office",
        "A curated shopping guide rounds up office products that would make fun gifts for fans of The Office, including a World's Best Boss mug, desk accessories, chargers, and a Dundie trophy.",
      ),
    ],
  },
  {
    id: "incidental-object-vs-central-event",
    genre: "celebrity",
    sourceDomains: ["pagesix.com"],
    expectedAnswers: ["FIRED"],
    forbiddenAnswers: ["FIRER", "CHAOS"],
    feedItems: [
      item(
        "pagesix.com",
        "TV host fired after a backstage dispute with producers",
        "The host lost the job after the confrontation. A source said the argument began when a coffee mug was thrown across the room, but the employment decision was the main development.",
      ),
    ],
  },
];
