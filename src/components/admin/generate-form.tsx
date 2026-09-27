import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@ponti-studios/ui/forms";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ponti-studios/ui/primitives";
import { useState } from "react";

import { FieldLabel as Label } from "~/components/field-label";
import {
  GENERATE_REASONING_EFFORTS,
  type GenerateReasoningEffort,
  type GenerateSourceMode,
} from "~/lib/admin/generate-types";
import { localDateToDateKey } from "~/lib/puzzle/date";

import styles from "./generate-form.module.css";

export const CUSTOM_PROMPT = "custom";
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
    dateKey: string;
    models: string[];
    promptFiles: readonly string[];
    topics: { id: number; slug: string; name: string }[];
    articles: { id: number; topicId: number; title: string }[];
    fixtures: string[];
  };
  onSubmit: (event: React.ChangeEvent<HTMLFormElement>) => void;
};
export function GenerateForm({ data, onSubmit }: GenerateFormProps) {
  const [sourceMode, setSourceMode] = useState<GenerateSourceMode>("articles");
  const [dateKey, setDateKey] = useState(data.dateKey);
  const initialTopicId = String(
    data.topics.find((topic) => topic.slug === data.gameSlug)?.id ?? data.topics[0]?.id ?? "",
  );
  const [topicId, setTopicId] = useState(initialTopicId);
  const [feedId, setFeedId] = useState(initialTopicId);
  const topicArticles = data.articles.filter((article) => String(article.topicId) === topicId);
  const [articleId, setArticleId] = useState(String(topicArticles[0]?.id ?? ""));
  const [fixtureId, setFixtureId] = useState("none");
  const [promptChoice, setPromptChoice] = useState(data.promptFiles[0] ?? CUSTOM_PROMPT);
  const [model, setModel] = useState(data.models[0] ?? "");
  const [maxTokens, setMaxTokens] = useState(String(DEFAULT_MAX_TOKENS));
  const [reasoningEffort, setReasoningEffort] = useState<GenerateReasoningEffort>("default");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/40 border-b">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Generation brief
        </p>
        <CardTitle>Set up a candidate run</CardTitle>
        <CardDescription>Choose the source, prompt, and model for this draft.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-8">
          <input type="hidden" name="game" value={data.gameSlug} />
          <input type="hidden" name="dateKey" value={dateKey} />
          <fieldset className="grid gap-5 border-b pb-8">
            <legend className="font-semibold">Source</legend>
            <p className="text-muted-foreground text-sm">
              Pick the material this run will use. Published puzzles stay unchanged.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className={styles.field}>
                <Label htmlFor="dateKey">Draft date</Label>
                <Input
                  type="date"
                  id="dateKey"
                  value={dateKey}
                  onChange={(event) => {
                    const nextDateKey = localDateToDateKey(
                      new Date(`${event.target.value}T00:00:00`),
                    );
                    if (nextDateKey) setDateKey(nextDateKey);
                  }}
                />
              </div>
              <div className={styles.field}>
                <Label htmlFor="sourceMode">Story source</Label>
                <input type="hidden" name="sourceMode" value={sourceMode} />
                <Select
                  value={sourceMode}
                  onValueChange={(value) => {
                    if (value) setSourceMode(value as GenerateSourceMode);
                  }}
                >
                  <SelectTrigger id="sourceMode" className={styles.trigger}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inventory">This topic’s unused articles</SelectItem>
                    <SelectItem value="feeds">Topics</SelectItem>
                    <SelectItem value="articles">Articles</SelectItem>
                    <SelectItem value="rss">A live RSS feed (review only)</SelectItem>
                    <SelectItem value="fixtures">A saved test fixture (review only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {sourceMode === "feeds" ? (
              data.topics.length === 0 ? (
                <p className="text-muted-foreground text-sm">No topics available.</p>
              ) : (
                <div className={styles.field}>
                  <Label htmlFor="feedIds">Topic</Label>
                  <input type="hidden" name="feedIds" value={feedId} />
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
              )
            ) : null}
            {sourceMode === "articles" ? (
              <>
                {data.topics.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No topics available.</p>
                ) : (
                  <div className={styles.field}>
                    <Label htmlFor="topicId">Topic</Label>
                    <input type="hidden" name="topicId" value={topicId} />
                    <Select
                      value={topicId}
                      onValueChange={(value) => {
                        if (!value) return;
                        setTopicId(value);
                        setArticleId(
                          String(
                            data.articles.find((article) => String(article.topicId) === value)
                              ?.id ?? "",
                          ),
                        );
                      }}
                    >
                      <SelectTrigger id="topicId" className={styles.trigger}>
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
                )}
                {topicArticles.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No unused articles for this topic.
                  </p>
                ) : (
                  <div className={styles.articleField}>
                    <Label htmlFor="articleIds">Article</Label>
                    <input type="hidden" name="articleIds" value={articleId} />
                    <Select
                      value={articleId}
                      onValueChange={(value) => value && setArticleId(value)}
                    >
                      <SelectTrigger id="articleIds" className={styles.articleTrigger}>
                        <SelectValue />
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
                  </div>
                )}
              </>
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
                <input type="hidden" name="fixtureId" value={fixtureId} />
                <Select value={fixtureId} onValueChange={(value) => value && setFixtureId(value)}>
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
          </fieldset>
          <fieldset className="grid gap-5 border-b pb-8">
            <legend className="font-semibold">Prompt</legend>
            <p className="text-muted-foreground text-sm">
              Select an approved prompt or provide a draft for review.
            </p>
            <div className={styles.field}>
              <Label htmlFor="promptChoice">Prompt</Label>
              <input type="hidden" name="promptChoice" value={promptChoice} />
              <Select
                value={promptChoice}
                onValueChange={(value) => value && setPromptChoice(value)}
              >
                <SelectTrigger id="promptChoice" className={styles.trigger}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.promptFiles.map((path) => (
                    <SelectItem key={path} value={path}>
                      {path.replace("app/lib/prompts/", "")}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_PROMPT}>Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <input
              type="hidden"
              name="promptSource"
              value={promptChoice === CUSTOM_PROMPT ? "paste" : "file"}
            />
            {promptChoice !== CUSTOM_PROMPT ? (
              <input type="hidden" name="promptPath" value={promptChoice} />
            ) : (
              <div className={styles.field}>
                <Label htmlFor="promptText">Custom prompt</Label>
                <Textarea id="promptText" name="promptText" rows={5} className="font-mono" />
              </div>
            )}
          </fieldset>
          <fieldset className="grid gap-5">
            <legend className="font-semibold">Model settings</legend>
            <p className="text-muted-foreground text-sm">
              Control the completion budget and reasoning depth.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
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
                Total completion budget. Reasoning models spend part of this thinking before they
                answer — too low and the model can run out of room before it writes anything.
              </p>
            </div>
            <div className={styles.field}>
              <Label htmlFor="reasoningEffort">Reasoning effort</Label>
              <input type="hidden" name="reasoningEffort" value={reasoningEffort} />
              <Select
                value={reasoningEffort}
                onValueChange={(value) => {
                  if (value) setReasoningEffort(value as GenerateReasoningEffort);
                }}
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
              <p className="text-muted-foreground text-xs">
                Caps how much the model "thinks" before answering. Lower effort is cheaper and
                faster but can hurt answer quality; not every model honors this.
              </p>
            </div>
          </fieldset>
          <Button type="submit" className="w-fit">
            Generate candidates
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
