# @fougere/schema
> L'entité et ses 4 axes
Une entité déclare des champs ; chaque champ porte quatre axes indépendants —
`shape` (du JSON Schema), `role` (primary, ref…), `lifecycle` (qui écrit la valeur,
à quel moment) et `boundary` (readOnly / writeOnly). Tout le reste de Fougere en
est une projection : tables, types GraphQL, contrats de formulaire, validation.

Ce paquet ne nomme aucun adaptateur et ne dépend d'aucun moteur.

```ts
import { entity, primary, text, auto, readOnly } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text(),
  authorId: readOnly(text()),
  createdAt: auto(),
}) {}

Post.validate({ title: 'Bonjour' }); // → { success, data } | { success: false, errors }
```

## Installation
```bash
pnpm add @fougere/schema
```

---

Fait partie de [Fougere](https://github.com/chok/fougere) — un schéma unique,
un gradient du monolithe au distribué, le même code utilisateur.
Documentation de référence : le site (`site/content`, fr/en).
