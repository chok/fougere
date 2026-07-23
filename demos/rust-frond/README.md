# rust-frond — un Frond hors TypeScript

Un frond `telemetry` écrit en Rust, consommé par du TypeScript qui ne connaît
aucune de ses entités. Il n'existe **aucun** `class Sensor extends entity({...})`
dans ce repo : la déclaration vit dans `src/main.rs`.

```bash
cargo run --release     # le frond Rust, :4200
npx tsx consumer.ts     # le consommateur TS, dans un autre terminal
```

## Ce que ça prouve

Le frond n'honore que deux contrats, et les deux sont du JSON :

1. **le fil** — `POST /_fougere/call`, JSON-RPC 2.0, `method = "entity.op"`,
   `params` = l'InvocationContext. Voir `packages/transport/http/src/jsonrpc.ts`.
2. **la carte** — `rpc.discover` rend ce qu'il héberge, schéma compris.
   Voir `packages/core/src/call.ts:31`.

Tout le reste lui appartient : le langage, le stockage, le juge.

Le moment qui compte est l'étape 4 du consommateur. `reconstruct()`
(`packages/schema/src/projections/reconstruct.ts:103`) rebâtit un schéma
**vivant** depuis la carte, et le juge TS refuse un payload avant tout réseau :

```
✗ couleur  — Unknown field
✗ celsius  — 250 is greater than 80.
✗ checksum — Read-only
✗ label    — String is too short (1 < 2).
```

Ces messages viennent de `@cfworker/json-schema`, côté TS, appliqués à des
règles qu'aucune ligne de TypeScript ne déclare. « La vérité voyage, la
réalisation varie » — au sens littéral.

## Les 4 axes sur le fil

`shape` EST du JSON Schema, au niveau supérieur du champ. Les trois autres
vivent sous `x-fougere` :

| axe | dans `src/main.rs` | effet côté TS |
|---|---|---|
| `role.primary` | `id` | exclu de `inputFields` |
| `lifecycle.create: 'now'` | `recordedAt` | exclu de `inputFields`, estampillé par Rust |
| `lifecycle.create: {generate}` | `id` | non requis à la création |
| `boundary.in: 'closed'` | `checksum` | `Read-only` si un client le fournit |

## Le trou que ça découvre

`createRemoteFacade` (`packages/core/src/remote.ts:79`) est un Proxy qui route
sur le **nom** de l'entité. La carte arrive avec `entity.schema` dedans
(`remote.ts:41-46`) et la boucle ne retient que `{ frond, transport }` : **le
schéma est reçu puis jeté.**

Conséquence : un frond distant donne des *appels*, pas de *schéma* — donc pas de
surface GraphQL sur lui, pas de `useFormFor` sur ses entités. Le consommateur
ici doit appeler `rpc.discover` à la main pour obtenir ce que la doublure a
déjà eu entre les mains.

Ce n'est pas un problème rustien : un split TS a exactement la même cécité, elle
ne se voit pas parce que l'app importe les classes en local de toute façon.

## Ce que la démo ne fait pas

- **Le type statique.** `reconstruct()` rend un `SchemaConstructor<Fields>` —
  runtime complet, clés littérales perdues. Récupérer `sensor.label` typé
  demanderait une projection carte → `.d.ts`, qui n'existe pas (aucun codegen
  dans `packages/cli/src`).
- **La carte est écrite à la main** (`sensor_card()`). Un vrai frond Rust la
  dériverait — `#[derive(Entity)]` sur la struct, avec `schemars` en dessous.
  C'est là que Rust est meilleur que TS : une macro voit la déclaration, là où
  Fougere paie un scan AST.
- **Les pertes documentées** de `card.ts:18-22` s'appliquent : une relation
  voyagerait par nom, un générateur custom aussi.
