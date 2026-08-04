# @fougere/site

Le site de Fougere — vitrine, docs, blog — construit avec Fougere : le blog est une Frond
(`fronds/blog`, draft→publish jugé), les docs sont du markdown Nuxt Content (`content/{en,fr}/docs`),
l'i18n est en/fr (`prefix_except_default` : `/docs`, `/fr/docs`).

```bash
pnpm dev                 # depuis site/ — dev server :3000
pnpm build && node .output/server/index.mjs   # build prod (voir Dockerfile pour les fixes de trace)
```

Tout l'état writable (SQLite + index content) vit sous `.data/` — c'est le seul volume à
monter en déploiement.

## Static

Le site se prérend vers de l'hébergement statique — c'est ce que fait
`.github/workflows/pages.yml` à chaque push sur `main`.

```bash
NITRO_PRESET=github_pages NUXT_APP_BASE_URL=/fougere/ pnpm generate
npx serve .output/public          # attention : sert à la racine, pas sous /fougere/
```

Ce qui traverse l'export : la vitrine, les docs (en/fr), et le **côté lecture** du
blog — rendu par la Frond au moment du build, exactement comme en SSR.

Ce qui ne traverse pas : écrire et se connecter, qui demandent un serveur.
`useReadOnlyDeployment()` le dérive du build (`import.meta.prerender`, mis dans le
payload) et retire l'entrée « Connexion » de la barre. Le fallback SPA rend
quand même n'importe quelle URL tapée à la main : `/login` dessine son formulaire,
qui n'a simplement plus de destinataire. Aucun chemin dans le site n'y mène.

Le blog statique est vide tant que `.data/` n'est pas dans git : la CI part d'une
base neuve. Pour publier des billets sur Pages, il faudrait des seeds — la lecture,
elle, marche déjà.

## Déployer

```bash
# depuis la racine du monorepo
SITE_AUTH_SECRET='...32+ chars...' SITE_URL='https://fougere.example' \
  docker compose -f site/docker-compose.yml up -d --build
```

Le build docker part de la **racine** (deps `workspace:*`), retire la référence workspace
`../sylvauth` (repo frère, hors contexte) et remplace le tracé Nitro partiel de
`jiti` par le paquet complet (issue pnpm connue).
