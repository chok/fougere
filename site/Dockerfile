# Build from the MONOREPO ROOT (workspace:* deps need the sibling packages):
#   docker build -f site/Dockerfile -t fougere-site .

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.6.0
# The prerender holds every page of the doc at once and outgrows Node's default heap of 2 GB.
ENV NODE_OPTIONS=--max-old-space-size=4096
WORKDIR /repo
COPY . .
# Trim the workspace to what the image needs: demos are irrelevant. The
# importer set no longer matches the lockfile, hence --no-frozen-lockfile
# (versions still resolve from it).
RUN sed -i '/demos/d' pnpm-workspace.yaml \
  && pnpm install --no-frozen-lockfile
RUN pnpm --filter "./packages/**" -r run build \
  && pnpm --filter "@fougere/site" run build
# The Nitro bundle carries the fronds: the statement the build wrote imports them, so no source,
# no TypeScript and no jiti are read at runtime. What stays outside the bundle is the native
# SQLite driver, which the source opens beside the app — installed alone, at the site's version,
# with the toolchain above to build it.
RUN mkdir -p /deploy && cd /deploy \
  && npm install --omit=dev --no-package-lock "better-sqlite3@$(node -p "require('/repo/site/package.json').dependencies['better-sqlite3']")"

# ── Run ──────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /repo/site/.output ./.output
# The rows a file source keeps — `posts:` in fougere.config.ts — are data, read from /app.
COPY --from=build /repo/site/posts ./posts
# The native driver the SQLite source opens beside the app.
COPY --from=build /deploy/node_modules ./node_modules
# .data holds all writable state: the SQLite db + Nuxt Content's index.
RUN mkdir -p .data && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
