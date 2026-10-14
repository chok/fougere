# @fougere/site

The Fougere site — landing page, docs, blog — built with Fougere: the blog is a Frond
(`fronds/blog`, a validated draft→publish), the docs are Nuxt Content markdown
(`content/docs`), served at `/docs`.

```bash
pnpm migrate             # from site/ — the boot only reads the schema
pnpm dev                 # dev server :3000
pnpm build && node .output/server/index.mjs   # prod build (see Dockerfile for the trace fixes)
```

Every piece of writable state (SQLite + the content index) lives under `.data/` — the
single volume to mount when deploying.

## Static

The site prerenders to static hosting — that is what `.github/workflows/pages.yml` does
on every push to `main`, publishing to https://fougere.dev/.

```bash
NITRO_PRESET=github_pages NUXT_APP_BASE_URL=/ pnpm generate
npx serve .output/public
```

What the export keeps: the landing page, the docs, and the **read side** of the blog —
rendered by the Frond at build time, exactly as it would be in SSR. Posts are files in
git (`posts/post/*.json`, the `posts` source in `fougere.config.ts`): written on a local
server, committed, and read by the build. A blog with no post answers 404 and is not written.

What it does not keep: writing and signing in, which need a server. `useReadOnlyDeployment()`
derives that from the build and `/login` and `/register` answer 404 there.

## Deploy

```bash
# from the monorepo root
SITE_AUTH_SECRET='...32+ chars...' SITE_URL='https://fougere.example' \
  docker compose -f site/docker-compose.yml up -d --build
```

The docker build starts from the **root** (`workspace:*` deps), trims `demos/*` out of
`pnpm-workspace.yaml` (the image needs none of them) and replaces Nitro's partial trace of
`jiti` and `@typescript/typescript6` with the full packages (a known pnpm issue).
