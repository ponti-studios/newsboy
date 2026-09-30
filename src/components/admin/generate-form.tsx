import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ponti-studios/ui/forms";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@ponti-studios/ui/data-display";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@ponti-studios/ui/primitives";
import { useState } from "react";

import { FieldLabel as Label } from "~/components/field-label";
import {
  GENERATE_REASONING_EFFORTS,
  type GenerateReasoningEffort,
  type GenerateSourceMode,
} from "~/lib/admin/generate-types";
import { localDateToDateKey } from "~/lib/puzzle/date";

import styles from "./generate-form.module.css";

export const DEFAULT_MAX_TOKENS = 4000;

const REASONING_EFFORT_LABELS: Record<GenerateReasoningEffort, string> = {
  default: "Default",
  none: "None (fastest, cheapest)",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
};

type GenerateFormProps = {
  data: {
    gameSlug: string;
    gameName: string;
    gameId: number;
    dateKey: string;
    selectedArticleId: string;
    selectedArticleUnavailable: boolean;
    models: string[];
    topics: { id: number; slug: string; name: string }[];
    articles: { id: number; topicId: number; title: string; publishedAt: string | null }[];
    fixtures: string[];
  };
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function formatPublishedAt(value: string | null) {
  if (!value) return "Publication date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Publication date unavailable";
  return `Published ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function GenerateForm({ data, onSubmit }: GenerateFormProps) {
  const [sourceMode, setSourceMode] = useState<GenerateSourceMode>("articles");
  const [dateKey, setDateKey] = useState(data.dateKey);
  const [articleSearch, setArticleSearch] = useState("");
  const topicArticles = data.articles.filter(
    (article) =>
      article.topicId === data.gameId &&
      article.title.toLowerCase().includes(articleSearch.toLowerCase()),
  );
  const [articleId, setArticleId] = useState(data.selectedArticleId);
  const [feedId, setFeedId] = useState(String(data.gameId));
  const [fixtureId, setFixtureId] = useState("none");
  const [model, setModel] = useState(data.models[0] ?? "");
  const [maxTokens, setMaxTokens] = useState(String(DEFAULT_MAX_TOKENS));
  const [reasoningEffort, setReasoningEffort] = useState<GenerateReasoningEffort>("default");
  const chosenArticle = data.articles.find((article) => String(article.id) === articleId);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/40 border-b">
        <CardTitle>{data.gameName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-6">
          <input type="hidden" name="game" value={data.gameSlug} />
          <input type="hidden" name="dateKey" value={dateKey} />
          <input type="hidden" name="sourceMode" value={sourceMode} />
          {sourceMode === "articles" ? (
            <input type="hidden" name="articleIds" value={articleId} />
          ) : null}
          {sourceMode === "feeds" ? <input type="hidden" name="feedIds" value={feedId} /> : null}
          {sourceMode === "fixtures" ? (
            <input type="hidden" name="fixtureId" value={fixtureId} />
          ) : null}

          <fieldset className="grid gap-4">
            <legend className="font-semibold">Puzzle details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={styles.field}>
                <Label htmlFor="dateKey">Puzzle date</Label>
                <Input
                  type="date"
                  id="dateKey"
                  value={dateKey}
                  onChange={(event) => {
                    const next = localDateToDateKey(new Date(`${event.target.value}T00:00:00`));
                    if (next) setDateKey(next);
                  }}
                />
              </div>
              <div className={styles.field}>
                <Label htmlFor="articleSearch">Find an unused article</Label>
                <Input
                  id="articleSearch"
                  type="search"
                  value={articleSearch}
                  onChange={(event) => setArticleSearch(event.target.value)}
                  placeholder="Search by title"
                  disabled={sourceMode !== "articles"}
                />
              </div>
            </div>
            {data.selectedArticleUnavailable ? (
              <p className="text-destructive text-sm">
                That article is no longer unused. Choose another article to continue.
              </p>
            ) : null}
            {sourceMode === "articles" ? (
              topicArticles.length === 0 ? (
                <p className="text-muted-foreground rounded-md border p-4 text-sm">
                  {articleSearch
                    ? "No unused articles match that search."
                    : "There are no unused articles for this game. Refresh its feed from Articles."}
                </p>
              ) : (
                <div className={styles.field}>
                  <Label htmlFor="articleIds">Unused article</Label>
                  <Select value={articleId} onValueChange={(value) => value && setArticleId(value)}>
                    <SelectTrigger id="articleIds" className={styles.articleTrigger}>
                      <SelectValue placeholder="Choose an article" />
                    </SelectTrigger>
                    <SelectContent className={styles.articleMenu}>
                      {topicArticles.map((article) => (
                        <SelectItem
                          key={article.id}
                          value={String(article.id)}
                          title={article.title}
                          className={styles.articleItem}
                        >
                          {article.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {chosenArticle ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatPublishedAt(chosenArticle.publishedAt)}
                    </p>
                  ) : null}
                </div>
              )
            ) : null}
          </fieldset>

          <Accordion type="single" collapsible className="border-t pt-1">
            <AccordionItem value="source-options" className="border-0">
              <AccordionTrigger className="px-0">Advanced source options</AccordionTrigger>
              <AccordionContent className="grid gap-4 px-0">
                <p className="text-muted-foreground text-sm">
                  Use a topic pool, inventory batch, RSS feed, or saved fixture for review.
                </p>
                <div className={styles.field}>
                  <Label htmlFor="sourceMode">Source</Label>
                  <Select
                    value={sourceMode}
                    onValueChange={(value) => value && setSourceMode(value as GenerateSourceMode)}
                  >
                    <SelectTrigger id="sourceMode" className={styles.trigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="articles">One unused article</SelectItem>
                      <SelectItem value="inventory">This game’s unused articles</SelectItem>
                      <SelectItem value="feeds">A topic’s unused articles</SelectItem>
                      <SelectItem value="rss">A live RSS feed (review only)</SelectItem>
                      <SelectItem value="fixtures">A saved test fixture (review only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {sourceMode === "feeds" ? (
                  <div className={styles.field}>
                    <Label htmlFor="feedIds">Topic</Label>
                    <Select value={feedId} onValueChange={(value) => value && setFeedId(value)}>
                      <SelectTrigger id="feedIds" className={styles.trigger}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {data.topics.map((topic) => (
                          <SelectItem key={topic.id} value={String(topic.id)}>
                            {topic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {sourceMode === "rss" ? (
                  <div className={styles.field}>
                    <Label htmlFor="feedUrl">RSS URL</Label>
                    <Input id="feedUrl" name="feedUrl" placeholder="https://" />
                    <p className="text-muted-foreground text-xs">
                      Review only. Ingest the story before it can become a published puzzle.
                    </p>
                  </div>
                ) : null}
                {sourceMode === "fixtures" ? (
                  <div className={styles.field}>
                    <Label htmlFor="fixtureId">Saved fixture</Label>
                    <Select
                      value={fixtureId}
                      onValueChange={(value) => value && setFixtureId(value)}
                    >
                      <SelectTrigger id="fixtureId" className={styles.trigger}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Choose a fixture</SelectItem>
                        {data.fixtures.map((id) => (
                          <SelectItem key={id} value={id}>
                            {id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion type="single" collapsible className="border-t pt-1">
            <AccordionItem value="model-options" className="border-0">
              <AccordionTrigger className="px-0">Model settings</AccordionTrigger>
              <AccordionContent className="grid gap-4 px-0">
                <p className="text-muted-foreground text-sm">
                  Adjust these only when a run needs different model behavior.
                </p>
                <div className={styles.field}>
                  <Label htmlFor="model">Model</Label>
                  <input type="hidden" name="model" value={model} />
                  <Select value={model} onValueChange={(value) => value && setModel(value)}>
                    <SelectTrigger id="model" className={styles.trigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.models.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={styles.field}>
                  <Label htmlFor="maxTokens">Max tokens</Label>
                  <Input
                    id="maxTokens"
                    name="maxTokens"
                    type="number"
                    min={200}
                    max={16000}
                    step={100}
                    value={maxTokens}
                    onChange={(event) => setMaxTokens(event.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Total completion budget. Reasoning models spend part of this thinking before
                    they answer.
                  </p>
                </div>
                <div className={styles.field}>
                  <Label htmlFor="reasoningEffort">Reasoning effort</Label>
                  <input type="hidden" name="reasoningEffort" value={reasoningEffort} />
                  <Select
                    value={reasoningEffort}
                    onValueChange={(value) =>
                      value && setReasoningEffort(value as GenerateReasoningEffort)
                    }
                  >
                    <SelectTrigger id="reasoningEffort" className={styles.trigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENERATE_REASONING_EFFORTS.map((effort) => (
                        <SelectItem key={effort} value={effort}>
                          {REASONING_EFFORT_LABELS[effort]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button
            type="submit"
            className="w-fit"
            disabled={sourceMode === "articles" && !articleId}
          >
            Generate candidates
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
