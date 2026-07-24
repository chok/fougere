# @fougere/schema-sql
> Entité → tables SQL, via Kysely
La réalisation SQL du schéma : les tables, la migration additive et l'ORM scopé par
entité. Quatre dialectes — SQLite, PostgreSQL, MySQL, SQL Server.

La validation juge, le storage réalise : cet ORM n'oppose aucun jugement à ce qu'un
handler lui confie, il applique les règles de `lifecycle`.

## Installation
```bash
pnpm add @fougere/schema-sql
```

---

Fait partie de [Fougere](https://github.com/chok/fougere) — un schéma unique,
un gradient du monolithe au distribué, le même code utilisateur.
Documentation de référence : le site (`site/content`, fr/en).
