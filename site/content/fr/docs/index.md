---
title: Qu'est-ce que Fougere
description: Une seule idée — vous déclarez le domaine, et tout en dérive, jusqu'au process où il tourne.
---

# Qu'est-ce que Fougere

Fougere est un framework TypeScript construit sur une seule idée : **vous déclarez le
domaine, et tout en dérive — jusqu'au process où il tourne.**

Énoncée à la forme négative, elle se vérifie : *la déclaration ne nomme rien en dehors
d'elle-même.* Ni table, ni protocole, ni hôte, ni adresse n'y figurent. Deux conséquences en
découlent, et on les vend d'habitude comme deux fonctionnalités distinctes :

| La déclaration ne nomme pas… | donc cette chose est… | son nom usuel |
|---|---|---|
| sa table, son type GraphQL, son formulaire, son juge | **dérivée** d'elle | single-schema |
| son hôte, son stockage, sa porte, son adresse | **choisie en dehors** d'elle | le gradient |

Une seule règle lue dans deux directions — ce qu'une déclaration produit, et ce dont on peut
l'entourer. Le reste de cette page, ce sont ces deux lectures.

## Ce qui en dérive

**Single-schema.** Une classe d'entité déclare vos données une fois — et juge elle-même
ses entrées : le même `validate()` tourne dans le navigateur et à la façade. Le juge est
lui-même une projection — dérivée de l'axe shape — mais une projection normative,
embarquée avec la classe : toutes les autres doivent lui obéir, et elle ne peut pas
dériver seule. Les tables
SQLite, les types GraphQL, les contrats de formulaire et les surfaces d'API sont des
*projections* de cette déclaration — rien n'est écrit deux fois.

```ts
import { entity, primary, text, created, oneOf, date, readOnly, optional } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  body: optional(text()),
  createdAt: created(),
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

## Ce qui est choisi en dehors

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

Les quatre familles que la règle refuse de nommer, dessinées — le gradient étant la
quatrième, lue comme un mouvement plutôt que comme une liste :

::agnostic-core
::

Et ça se vérifie au `diff` : les cinq demos qui servent ce même blog sous Next,
TanStack Start, React Router, SvelteKit et Express partagent un répertoire `fronds/`
identique à l'octet, et trois de ces hôtes ne demandent aucun paquet Fougere. Alors
*progressif* ne veut dire que ceci : chaque pas vers l'extérieur
[énonce son prix](/fr/docs/infra/gradient#cinq-barreaux-et-le-prix-de-chacun), et aucun ne
demande de réécrire ce que vous avez écrit.

## Ordre de lecture

**Concepts** — [Philosophie](/fr/docs/concepts/philosophy) · [La Frond](/fr/docs/concepts/frond) ·
[Le socle](/fr/docs/concepts/the-base)

**Côté serveur** — [Une app que vous avez déjà](/fr/docs/existing-app) ·
[Apportez votre schéma](/fr/docs/bring-your-schema) · [Démarrer](/fr/docs/getting-started) ·
[La CLI](/fr/docs/cli) ·
[Entités](/fr/docs/schema/entities) · [Vues](/fr/docs/schema/views) ·
[Standard Schema](/fr/docs/schema/standard-schema) · [Handlers](/fr/docs/business/handlers) ·
[Presenters](/fr/docs/business/presenters) · [Collectors](/fr/docs/business/collectors) · [Erreurs](/fr/docs/business/errors) · [Seeds](/fr/docs/business/seeds) ·
[Les faits](/fr/docs/business/facts) · [Le port ORM](/fr/docs/business/orm) · [Les repositories](/fr/docs/business/repositories)

**Côté client** — [Queries & commands](/fr/docs/client/queries-commands) ·
[Formulaires](/fr/docs/client/forms) · [Session](/fr/docs/client/session) · [invoke](/fr/docs/client/invoke)

**Topologie** — [Le gradient](/fr/docs/infra/gradient) · [Surfaces](/fr/docs/infra/surfaces) ·
[Déploiement](/fr/docs/infra/deployment) · [Les hôtes](/fr/docs/infra/hosts) ·
[Les sources](/fr/docs/infra/sources)

> **Statut.** Fougere est en alpha : les paquets `@fougere/*` sont sur npm sous le tag
> `alpha`, et cette documentation décrit l'API telle qu'elle existe dans le dépôt
> aujourd'hui. Ce site tourne dessus.
