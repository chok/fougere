# Fougere

Fougere est un framework TypeScript construit sur un modèle applicatif — entités, opérations, frontières de propriété — projeté vers Nuxt, SQL, GraphQL et les formulaires. L'ambition : garder le domaine stable pendant que la topologie évolue de local à distribué.

Deux idées le portent :

1. **Single-schema** — une classe d'entité (`class Post extends entity({...})`) dérive la validation (le même juge dans le navigateur et à la façade), les tables, les types GraphQL, les contrats de formulaire et la surface d'API. Rien n'est écrit deux fois.
2. **Le gradient** — un module métier (« Frond ») tourne in-process ou dans son propre process derrière JSON-RPC 2.0, avec un code utilisateur identique. `remotes: { blog: 'http://…' }` dans la config est l'énoncé de topologie entier.

## Statut — pré-release

Les packages ne sont pas encore sur npm ; une app Fougere vit aujourd'hui en workspace pnpm à côté du framework. Ce qui est vérifié, vu tourner :

- les 5 primitives client (`useQuery`/`useCommand`, `useFormFor`, `useCurrentUser`, `invoke`) sont le seul chemin ;
- une feature métier jugée (draft→publish) validée en navigateur ;
- le split vécu au quotidien : host tué → 503 typé dans les pages, relancé → récupération ;
- code utilisateur identique in-process et split, jusqu'au build de prod ;
- [le site de Fougere](./site) — vitrine, docs, blog — est une app Fougere.

## Essayer

```bash
pnpm install
pnpm -r --filter './packages/**' build

# Le site (vitrine + docs + blog Frond) — la doc la plus complète
pnpm -C site dev                   # :3000

# Le demo phare — primitives + gradient
pnpm -C demos/nuxt-blog dev:blog   # la Frond blog seule (:4100)
pnpm -C demos/nuxt-blog dev        # l'app Nuxt qui la consomme (:3000)
# Commenter `remotes:` dans demos/nuxt-blog/fougere.config.ts → même app in-process

pnpm -r test
```

## Monorepo

- [`packages/`](./packages) — schema, adapters (SQL, GraphQL, REST), core (scanner, contrat d'appel), transport HTTP, module Nuxt, auth
- [`site/`](./site) — le site de Fougere, construit avec Fougere
- [`demos/`](./demos) — démos et prototypes d'usage

La documentation de référence est celle du site (`site/content/`, en/fr) : entités et les 4 axes, vues, handlers, collectors, erreurs, seeds, primitives client, gradient, surfaces, déploiement.

## Lire selon le besoin

- La philosophie et le modèle : [site — Concepts](./site/content/fr/docs/2.concepts/1.philosophy.md)
- Le gradient : [site — Le gradient](./site/content/fr/docs/6.infra/1.gradient.md)
- Le déploiement : [site — Déploiement](./site/content/fr/docs/6.infra/3.deployment.md)
