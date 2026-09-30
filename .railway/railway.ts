import { defineRailway, github, preserve, project, service } from "railway/iac";

export const partial = "newsboy";

export default defineRailway(() =>
  project("hominem", {
    resources: [
      service("newsboy", {
        source: github("ponti-studios/newsboy", { branch: "main", checkSuites: false }),
        build: {
          builder: "DOCKERFILE",
          dockerfilePath: "Dockerfile",
          watchPatterns: ["**"],
        },
        start: "./node_modules/.bin/react-router-serve ./build/server/index.js",
        healthcheck: "/healthz",
        healthcheckTimeout: 300,
        preDeploy: "node scripts/check-production-migration.mjs",
        networking: {
          serviceDomains: { "what-production-7642.up.railway.app": {} },
          customDomains: { "newsboy.ponti.io": {}, "what.ponti.io": {} },
          privateNetworkEndpoint: "what",
        },
        variables: {
          ADMIN_SECRET: preserve(),
          DATABASE_URL: preserve(),
          GAME_ADMIN_EMAILS: preserve(),
          GAME_DEFAULT_SLUG: preserve(),
          HOMINEM_API_URL: preserve(),
          HOMINEM_INTERNAL_API_URL: preserve(),
          NEWSBOY_AI_MODEL: preserve(),
          NEWSBOY_APP_URL: preserve(),
          OPENROUTER_API_KEY: preserve(),
          VITE_POSTHOG_HOST: preserve(),
        },
      }),
    ],
  }),
);
