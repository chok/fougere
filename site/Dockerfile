# Build from the MONOREPO ROOT (workspace:* deps need the sibling packages):
#   docker build -f site/Dockerfile -t fougere-site .

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10
WORKDIR /repo
COPY . .
# Trim the workspace to what the image needs: demos are irrelevant. The
# importer set no longer matches the lockfile, hence --no-frozen-lockfile
# (versions still resolve from it).
RUN sed -i '/demos/d' pnpm-workspace.yaml \
  && pnpm install --no-frozen-lockfile
RUN pnpm --filter "./packages/**" -r run build \
  && pnpm --filter "@fougere/site" run build
# Known monorepo issue: Nitro's trace of packages with lazy internals is
# partial under pnpm (jiti misses its babel transform for the runtime frond
# scanner). Replace them with the real packages, and add the TS the scanner
# dynamically imports — `@typescript/typescript6`, the JS compiler API, which the
# root TS 7 does not expose. drizzle-orm used to sit in this list; the ORM is
# Kysely now, a single-entrypoint package that needs no such treatment.
#
# Each entry is `store-glob:package-name`, and the two are NOT the same string for
# a scoped package: pnpm writes `@typescript+typescript6@6.0.2` in the store while
# the name resolution needs `@typescript/typescript6`. Deriving the name from the
# glob is what broke this: it copied `typescript` (5.9, still in the store because
# something else pulls it), so the loop SUCCEEDED and exited 0 while the package the
# scanner imports was absent — a break that only surfaced at the first scan, which
# for the site is at boot.
RUN mkdir -p site/.output/server/node_modules \
  && for spec in "jiti@:jiti" "@typescript+typescript6@:@typescript/typescript6"; do \
       glob="${spec%%:*}"; name="${spec#*:}"; \
       rm -rf "site/.output/server/node_modules/$name"; \
       mkdir -p "$(dirname "site/.output/server/node_modules/$name")"; \
       cp -RL "$(ls -d node_modules/.pnpm/${glob}*/node_modules/$name | head -1)" \
         "site/.output/server/node_modules/$name" || exit 1; \
     done
# The @fougere/* workspace packages are inlined in the Nitro bundle, but the
# runtime frond scanner loads fronds/**/*.ts which import them (and their
# transitive deps: better-auth…) by name. pnpm deploy produces the
# self-contained node_modules that resolution needs — no hand-rolled tracing.
RUN pnpm --filter "@fougere/site" deploy --prod --legacy /deploy

# ── Run ──────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /repo/site/.output ./.output
COPY --from=build /repo/site/fronds ./fronds
# fronds/*.ts resolve their imports by walking up to /app/node_modules — the
# pnpm-deployed closure of the site's prod deps.
COPY --from=build /deploy/node_modules ./node_modules
# .data holds all writable state: the SQLite db + Nuxt Content's index.
RUN mkdir -p .data && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
