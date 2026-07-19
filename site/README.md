# @fougere/site

Le site de Fougere — vitrine, docs, blog — construit avec Fougere : le blog est une Frond
(`fronds/blog`, draft→publish jugé), les docs sont du markdown Nuxt Content (`content/{en,fr}/docs`),
l'i18n est en/fr (`prefix_except_default` : `/docs`, `/fr/docs`).

```bash
pnpm dev                 # depuis site/ — dev server :3000
pnpm build && node .output/server/index.mjs   # build prod (voir Dockerfile pour le fix drizzle-orm)
```

Tout l'état writable (SQLite + index content) vit sous `.data/` — c'est le seul volume à
monter en déploiement.

## Déployer

```bash
# depuis la racine du monorepo
SITE_AUTH_SECRET='...32+ chars...' SITE_URL='https://fougere.example' \
  docker compose -f site/docker-compose.yml up -d --build
```

Le build docker part de la **racine** (deps `workspace:*`), retire la référence workspace
`../sylvauth` (repo frère, hors contexte) et remplace le tracé Nitro partiel de
`drizzle-orm` par le paquet complet (issue pnpm connue).
