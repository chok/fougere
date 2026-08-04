# @fougere/site

The Fougere site — landing page, docs, blog — built with Fougere: the blog is a Frond
(`fronds/blog`, a judged draft→publish), the docs are Nuxt Content markdown
(`content/{en,fr}/docs`), i18n is en/fr (`prefix_except_default`: `/docs`, `/fr/docs`).

```bash
pnpm dev                 # from site/ — dev server :3000
pnpm build && node .output/server/index.mjs   # prod build (see Dockerfile for the trace fixes)
```

Every piece of writable state (SQLite + the content index) lives under `.data/` — the
single volume to mount when deploying.

## Static

The site prerenders to static hosting — that is what `.github/workflows/pages.yml` does
on every push to `main`, publishing to https://chok.github.io/fougere/.

```bash
NITRO_PRESET=github_pages NUXT_APP_BASE_URL=/fougere/ pnpm generate
npx serve .output/public          # note: serves at the root, not under /fougere/
```

What survives the export: the landing page, the docs (en/fr), and the **read side** of
the blog — rendered by the Frond at build time, exactly as it would be in SSR.

What does not: writing and signing in, which need a server. `useReadOnlyDeployment()`
derives that from the build (`import.meta.prerender`, put in the payload) and removes the
"Sign in" entry from the bar. The SPA fallback still renders any hand-typed URL: `/login`
draws its form, which simply has no recipient. No path through the site leads there.

The static blog is empty as long as `.data/` is out of git: CI starts from a fresh
database. Publishing posts on Pages would take seeds — the reading side already works.

## Deploy

```bash
# from the monorepo root
SITE_AUTH_SECRET='...32+ chars...' SITE_URL='https://fougere.example' \
  docker compose -f site/docker-compose.yml up -d --build
```

The docker build starts from the **root** (`workspace:*` deps), drops the `../sylvauth`
workspace reference (a sibling repo, out of context) and replaces Nitro's partial trace of
`jiti` with the full package (a known pnpm issue).
