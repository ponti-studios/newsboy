ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION} AS base

WORKDIR /app
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable

FROM base AS build

ARG NEWSBOY_APP_URL
ENV NEWSBOY_APP_URL=$NEWSBOY_APP_URL

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
RUN pnpm install --frozen-lockfile --config.minimum-release-age=0
COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:${NODE_VERSION} AS runner

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid app --home-dir /app --shell /usr/sbin/nologin app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/build ./build
COPY --from=build --chown=app:app /app/src/data ./data
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/migrations ./migrations
COPY --from=build --chown=app:app /app/src/prompts ./src/prompts

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT}/healthz || exit 1

CMD ["./node_modules/.bin/react-router-serve", "./build/server/index.js"]
