---
title: Qu'est-ce que Fougere
description: Un framework TypeScript construit autour de deux idées — single-schema et le gradient.
---

# Qu'est-ce que Fougere

Fougere est un framework TypeScript construit autour de deux idées.

**Single-schema.** Une classe d'entité déclare vos données une fois — et juge elle-même
ses entrées : le même `validate()` tourne dans le navigateur et à la façade. Le juge est
lui-même une projection — dérivée de l'axe shape — mais une projection normative,
embarquée avec la classe : toutes les autres doivent lui obéir, et elle ne peut pas
dériver seule. Les tables
SQLite, les types GraphQL, les contrats de formulaire et les surfaces d'API sont des
*projections* de cette déclaration — rien n'est écrit deux fois.

```ts
import { entity, primary, text, auto, oneOf, date, readOnly, optional } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  body: optional(text()),
  createdAt: auto(),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  publishedAt: readOnly(optional(date())),
}) {}
```

::derivation-diagram
::

Cette seule classe est à la fois :

- le **type TypeScript** d'une ligne (`function render(p: Post)` — pas d'`Infer<typeof …>`),
- le **validateur** des entrées client (`Post.validate(input)`),
- la **metadata** que chaque adapter lit (`Post.getFields()`),
- la **désignation** que les pages utilisent pour appeler les opérations (`useQuery(Post, 'list')`),
- le **nom nominal** que l'injection de dépendances matche dans les signatures (`user: User | null`).

**Le gradient.** La logique métier vit dans des *Fronds* — des modules autonomes
d'entités, handlers, collectors et seeds. Une Frond tourne in-process aujourd'hui et dans
son propre process demain, derrière JSON-RPC 2.0, avec un **code utilisateur identique**.
L'énoncé de topologie entier tient en une ligne de config :

```ts
// fougere.config.ts
remotes: { blog: 'http://127.0.0.1:4100' }
```

Pas de RPC sans voyage : un appel est une valeur `(entity, operation, invocation)` ; le
runner l'exécute directement en mémoire quand la Frond est locale et la met sur le fil
quand elle est distante. Les transports déplacent la valeur — ils ne la remodèlent jamais.

Donc le split coûte le saut et le JSON qui voyage avec, et rien d'autre : aucune
sérialisation que le chemin local éviterait, aucun impôt du framework par-dessus le réseau.

## Ordre de lecture

**Concepts** — [Philosophie](/fr/docs/concepts/philosophy) · [La Frond](/fr/docs/concepts/frond)

**Côté serveur** — [Démarrer](/fr/docs/getting-started) · [App Nuxt existante](/fr/docs/existing-app) ·
[La CLI](/fr/docs/cli) ·
[Entités](/fr/docs/schema/entities) · [Vues](/fr/docs/schema/views) · [Handlers](/fr/docs/business/handlers) ·
[Presenters](/fr/docs/business/presenters) · [Collectors](/fr/docs/business/collectors) · [Erreurs](/fr/docs/business/errors) · [Seeds](/fr/docs/business/seeds)

**Côté client** — [Queries & commands](/fr/docs/client/queries-commands) ·
[Formulaires](/fr/docs/client/forms) · [Session](/fr/docs/client/session) · [invoke](/fr/docs/client/invoke)

**Topologie** — [Le gradient](/fr/docs/infra/gradient) · [Surfaces](/fr/docs/infra/surfaces) ·
[Déploiement](/fr/docs/infra/deployment)

> **Statut.** Fougere est en pré-version : les paquets `@fougere/*` ne sont pas encore sur
> npm, et cette documentation décrit l'API telle qu'elle existe dans le dépôt aujourd'hui.
> Ce site tourne dessus.
