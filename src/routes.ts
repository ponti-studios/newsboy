import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  route(
    "/.well-known/appspecific/com.chrome.devtools.json",
    "routes/well-known.chrome-devtools.ts",
  ),
  route("/healthz", "routes/healthz.ts"),
  route("/api/games", "routes/api.games.ts"),
  route("/api/:topic/attempt", "routes/api.$topic.attempt.ts"),
  route("/api/:topic/guess", "routes/api.$topic.guess.ts"),
  route("/api/history", "routes/api.history.ts"),
  route("/api/:topic/puzzle", "routes/api.$topic.puzzle.ts"),
  route("/api/:topic/puzzle/:date", "routes/api.$topic.puzzle.$date.ts"),
  route("/api/words/validate", "routes/api.words.validate.ts"),
  layout("routes/app-layout.tsx", [
    index("routes/topic-redirect.tsx"),
    route("/admin", "routes/admin.tsx", [
      index("routes/admin._index.tsx"),
      route("inventory", "routes/admin.inventory.tsx"),
      route("generate", "routes/admin.generate.tsx"),
      route("generate/events", "routes/admin.generate.events.ts"),
      route("generate/stream", "routes/admin.generate.stream.ts"),
      route("preview", "routes/admin.preview-redirect.ts"),
      route("preview/events", "routes/admin.preview.events.ts"),
      route("topics", "routes/admin.topics.tsx"),
      route("topics/:slug", "routes/admin.topics.$slug.tsx"),
      route("generations/:id", "routes/admin.generations.$id.tsx"),
      route("dates/:date", "routes/admin.dates.$date.tsx"),
      route("costs", "routes/admin.costs.tsx"),
    ]),
    route("/history", "routes/history.tsx"),
    route("/:topic", "routes/topic.tsx"),
    route("/:topic/:dateKey", "routes/topic.$dateKey.tsx"),
  ]),
] satisfies RouteConfig;
