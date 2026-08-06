---
title: Qu'est-ce que Fougere
description: Présentation du schéma partagé et de l'exécution locale ou distante.
---

# Qu'est-ce que Fougere

Fougere est un framework TypeScript construit autour de deux idées.

**Single-schema.** Une classe d'entité décrit les données et valide les entrées. La même
méthode `validate()` s'exécute dans le navigateur et à la façade. La classe contient aussi
les métadonnées lues par les adapters SQLite et GraphQL, les formulaires et les surfaces
d'API. Toutes lisent cette déclaration.

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

Cette classe fournit :

- le **type TypeScript** d'une ligne (`function render(p: Post)` — pas d'`Infer<typeof …>`),
- le **validateur** des entrées client (`Post.validate(input)`),
- la **metadata** que chaque adapter lit (`Post.getFields()`),
- la **désignation** que les pages utilisent pour appeler les opérations (`useQuery(Post, 'list')`),
- le **nom nominal** que l'injection de dépendances matche dans les signatures (`user: User | null`).

**Le gradient.** La logique métier est regroupée dans des *Fronds*, composées d'entités,
de handlers, de collectors et de seeds. Une Frond s'exécute localement par défaut. Elle
peut être routée vers un hôte JSON-RPC 2.0 avec une entrée de configuration :

```ts
// fougere.config.ts
remotes: { blog: 'http://127.0.0.1:4100' }
```

Un appel est représenté par `(entity, operation, invocation)`. Le runner l'exécute en
mémoire pour une Frond locale. Pour une Frond distante, le transport l'encode et l'envoie
à l'hôte. Ce second chemin ajoute donc un saut HTTP, la sérialisation JSON et les
contraintes habituelles du réseau.

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
