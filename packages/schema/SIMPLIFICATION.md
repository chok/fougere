# Simplification ciblée de `@fougere/schema`

## Statut de cette proposition

Cette version remplace le plan initial après relecture contradictoire du code et des raisons
architecturales déjà consignées dans le dépôt.

Le plan est volontairement ramené à trois lots :

1. corriger les contrats écrits qui ne correspondent plus au code ;
2. déplacer le codegen TypeScript vers son propriétaire réel, le CLI ;
3. replacer l'unicité composite au niveau du schéma.

Les sous-chemins publics, le plancher générique `model/`, la suppression systématique des cycles,
la refonte de `SchemaView` et le remplacement des classes par des fonctions sont ajournés. Aucun
de ces changements ne doit être entrepris dans les trois lots ci-dessous.

## Mesures de référence

Au 4 septembre 2026 :

- `packages/schema/src` contient 70 fichiers et environ 4 200 lignes ;
- `src/index.ts` contient 61 instructions `export` ;
- ces instructions exposent 102 liaisons TypeScript nommées et uniques ;
- le module JavaScript compilé expose 56 liaisons runtime ;
- les quatre dépendances déclarées sont réellement utilisées ;
- la suite contient 32 fichiers et 364 tests passants ;
- le typecheck du paquet passe ;
- `pnpm arch:cycles` ne trouve aucun cycle non déclaré.

Ces chiffres décrivent la situation, mais ne décident pas à eux seuls de l'emplacement d'un
concept. Le critère principal est la propriété : quelle partie du système possède la décision ?

## Invariants à préserver

Les trois lots doivent préserver les propriétés suivantes :

- une entité reste une classe utilisable comme valeur et comme type de ligne ;
- `entity({...})` reste le point d'entrée principal ;
- le vocabulaire de champs ne change pas ;
- `pick`, `omit`, `rename`, `partial`, `extend` et `anchor` gardent leurs comportements ;
- une dérivation reste rattachée à son origine canonique ;
- la validation locale, `RowJudge` et Standard Schema rendent le même verdict ;
- la validation ne réalise pas les valeurs par défaut ;
- les objets de champ étrangers ou hostiles sont contrôlés avant d'entrer dans une entité ;
- les protections contre `__proto__` restent en place ;
- le format wire v1 de `Card` et `Bundle` reste lisible et byte-compatible à l'écriture ;
- une contrainte unique composite amputée disparaît ;
- une contrainte unique composite renommée suit le renommage ;
- une unicité simple reste une contrainte de colonne pour SQL ;
- une unicité composite reste une contrainte de table pour SQL ;
- les configurations propres aux adaptateurs restent ouvertes par augmentation de module.

## Ce qui est conservé après relecture

### `Cases` reste dans `@fougere/schema`

`Cases` dérive uniquement des axes, de `RowJudge` et de l'ensemble fermé `RowRefusal`. La partie
qui fabrique des valeurs reste déjà dans `@fougere/testing`, avec le faker qui ne doit pas atteindre
le paquet chargé dans le navigateur.

`RowRefusal` est utilisé par `RowJudge` pour produire ses refus et par `Cases` pour vérifier que la
table couvre leur ensemble fermé. Déplacer `Cases` obligerait soit à exposer ce mécanisme comme un
contrat inter-paquets, soit à dupliquer cette liste. Aucun des deux résultats n'est plus simple.

### Les cycles déclarés ne sont pas une cible

Les cycles de familles de `packages/schema` sont connus, argumentés et surveillés. Une architecture
acyclique n'est pas une fin en soi. Aucun dossier `model/`, `validation/` ou `wire/` ne doit être créé
sans démontrer d'abord que la raison écrite pour le cycle concerné est fausse.

### Les classes de décision restent des classes

Le dépôt exprime une décision par un propriétaire instancié sur son sujet. Le remplacement de
`FieldJudge.of(value).verdict` par une fonction libre contredirait cette convention sans supprimer
un invariant ni une duplication. Ce changement est retiré du plan.

### Les sous-chemins publics sont ajournés

La séparation `inspect`, `wire` et `extensions` pourrait réduire la surface conceptuelle, mais son
coût physique n'a pas été mesuré sur le bundle navigateur réel. Ajouter plusieurs entrées publiques
est aussi une augmentation de l'API à maintenir.

Le sujet ne pourra être rouvert qu'avec une mesure reproductible du graphe et du poids réellement
chargés par un consommateur navigateur, avant et après l'extraction envisagée.

## Lot 1 — Réconcilier les contrats écrits et le code

### Objectif

Corriger les contradictions confirmées sans refondre l'architecture ni modifier implicitement les
comportements wire.

### 1. Corriger le README sur les dépendances

Le README porte **deux** affirmations distinctes, et une seule est fausse.

`This package names no adapter and depends on no engine.` — **vraie**, et bien formulée. Elle
parle d'un adaptateur et d'un moteur, pas d'un paquet npm. Ne pas y toucher.

`the spec types are inlined rather than depended on, so this package stays zero-dependency.` —
**fausse dans ses deux moitiés** depuis que `projection/standard.ts` a cessé de recopier la spec.
Le commentaire de ce fichier raconte lui-même pourquoi la copie a été abandonnée : elle avait
silencieusement pris une version de retard.

Les quatre dépendances sont toutes réellement importées :

- `@cfworker/json-schema` juge les entrées et les valeurs ;
- `@paralleldrive/cuid2` fournit le générateur par défaut ;
- `@standard-schema/spec` fournit les types officiels de Standard Schema ;
- `dequal` compare les déclarations et les cartes.

Corriger la seconde phrase seulement, et lui laisser dire ce qui est vrai et utile à sa place :
le paquet importe la spécification chez celui qui la publie, et ce paquet est types-only —
son `index.js` fait zéro octet, donc il ne coûte rien à un navigateur. C'est déjà ce
qu'établit le commentaire de `standard.ts`.

Ne retirer aucune dépendance dans ce lot, et ne réécrire aucune autre phrase du README.

### 2. Corriger le commentaire de `Schema.compose`

La loi existante est une fusion de gauche à droite où le dernier élément gagne. Elle est appliquée
aux champs, aux options de validation et aux entrées d'adaptateur par champ.

L'implémentation et les tests font autorité. Corriger uniquement le commentaire qui annonce à tort
le refus d'une collision. Ne pas modifier le comportement de fusion.

### 3. Resserrer le type d'entrée Standard Schema

Le contrat générique connaît déjà `TFields` et le type de ligne correspondant. Essayer de déclarer
l'entrée de `~standard` comme `PartialRow<TFields>` plutôt que `Record<string, unknown>`.

La modification n'est acceptée que si TypeScript peut l'exprimer honnêtement. Si le getter statique
de la classe de base ne peut pas atteindre le paramètre générique, ne pas introduire de cast pour
forcer le résultat. Documenter alors la limite exacte et laisser le type actuel.

Le test d'intégration TanStack Form doit perdre son `@ts-expect-error` seulement si le resserrement
est réellement reconnu par le compilateur. Les tests tRPC doivent rester inchangés dans leur
intention.

### 4. Trancher la couverture de `demo/`, puis expliciter `Schema.from`

`Schema.from` n'a pas d'appelant de production hors du paquet. Cinq usages existent dans
`packages/schema/demo/`, comme projection et décodeur tolérant.

**Cet argument ne tient que si ces fichiers sont vérifiés, et ils ne le sont pas.** Mesuré :
`tsconfig.json` inclut `src`, `tsconfig.test.json` inclut `src` et `tests`, et `vitest.config.ts`
ne lit que `tests/**/*.test.ts`. Le dossier `demo/` est en dehors des trois — rien ne le compile,
rien ne l'exécute. Un appel qui y figure prouve que quelqu'un l'a écrit un jour, pas qu'il tient
encore.

À trancher dans ce lot, avant de conclure sur `Schema.from` :

- **soit** `demo` rejoint `include` dans `tsconfig.test.json`, et ces cinq usages deviennent une
  justification vérifiée — c'est l'option recommandée, elle coûte un mot et protège aussi les
  lots 2 et 3, qui peuvent changer `unique` sous ces fichiers sans que rien ne le dise ;
- **soit** `demo/` reste hors couverture, et il ne peut pas fonder la conservation d'une API :
  la conclusion redevient « aucun appelant vérifié », et `Schema.from` rejoint `Schema.compose`
  et `Schema.named` dans le chantier de réduction ultérieur.

Si la première option est retenue et que les démos ne compilent pas en l'état, c'est un fait à
rapporter, pas à réparer en silence dans ce lot.

Dans les deux branches, `Schema.from` est conservé au lot 1 : la suppression d'une API et la
correction d'un contrat écrit ne se mélangent pas. Ce que la branche décide, c'est s'il entre
ou non dans le chantier de réduction ultérieur.

Corriger son contrat écrit :

- il projette seulement les champs connus ;
- il ne juge pas une ligne ;
- il tente le décodage des valeurs présentes ;
- lorsqu'un décodeur refuse, il conserve volontairement la valeur brute.

Ne pas le transformer en juge et ne pas modifier son résultat.

`Schema.from`, `Schema.compose` et `Schema.named` pourront être réévalués ensemble dans un chantier
ultérieur fondé sur leurs scénarios utilisateurs. Ils ne sont pas supprimés dans ce lot afin de ne
pas mélanger correction documentaire et réduction d'API.

### 5. Épingler uniquement le contrat wire

Ajouter des fixtures dorées pour :

- une carte représentative contenant les quatre axes ;
- une dérivation avec renommage et suppression ;
- un bundle contenant des relations ;
- une unicité simple ;
- une unicité composite ;
- le round-trip schéma → carte → schéma ;
- le round-trip bundle → schémas → bundle.

Comparer les octets JSON au point où la carte est produite — `Card.describe` et son pendant sur
`Bundle` — plutôt qu'une structure en mémoire, qui ne dirait rien de ce qu'un lecteur étranger
reçoit.

Cinq fichiers de test touchent déjà à la carte, et **aucun ne pose la question de ces fixtures**.
En particulier, `tests/characterization-card-bundle-parity.test.ts` compare `Card` et `Bundle`
sur `describe`, `reconstruct` et `diff` : il vérifie que **deux chemins s'accordent**, jamais que
la sortie n'a pas bougé. Les deux tests répondent donc à des questions différentes et ne se
remplacent pas.

Vérifier ce point avant d'écrire les fixtures, et le dire dans le compte rendu — pour que
personne ne les prenne plus tard pour un second juge du même fait.

Ne pas ajouter de snapshot exhaustif de la surface publique. Épingler les 102 liaisons actuelles
rendrait toute réduction volontaire artificiellement coûteuse. Le wire v1 est le contrat qui traverse
une frontière non contrôlée ; c'est lui qui mérite un verrou de non-régression.

### Hors périmètre du lot 1

- aucun déplacement de fichier ;
- aucun changement de dépendance ;
- aucune nouvelle entrée publique ;
- aucune modification de représentation interne ;
- aucune modification wire ;
- aucune conversion de classe en fonction ;
- aucune réécriture de commentaire hors des contradictions nommées ci-dessus.

### Vérifications du lot 1

```sh
pnpm --filter @fougere/schema test
pnpm --filter @fougere/schema typecheck
pnpm arch:cycles
```

### Retour attendu après le lot 1

S'arrêter avant le lot 2 et fournir :

- une phrase sur le changement réalisé pour chacun des cinq points ;
- le résultat exact de la tentative de resserrement de `~standard` ;
- la branche retenue pour `demo/`, et ce que `Schema.from` devient en conséquence ;
- la liste des fixtures wire ajoutées ;
- les commandes exécutées et leur résultat ;
- la liste des comportements volontairement laissés inchangés.

## Lot 2 — Déplacer le codegen TypeScript dans le CLI

### Objectif

Déplacer deux projections vers le seul composant qui les utilise et supprimer une duplication
réelle.

### Justification

`EntityTypeSource` lit un `SchemaDescriptor` et produit du TypeScript. Il n'importe ni champ, ni axe,
ni juge.

`FacadeTypeSource` ne connaît pas le schéma d'un champ. Il transforme des opérations en interface
TypeScript et écrit directement le vocabulaire `Invocation` appartenant au contrat d'appel.

Le seul lecteur de production des deux classes est le handler de synchronisation du CLI. Leur
propriétaire est donc le CLI, pas `@fougere/schema`.

### Travaux

1. déplacer `EntityTypeSource` et `FacadeTypeSource` sous la famille de synchronisation du CLI ;
2. déplacer leurs tests depuis `packages/schema/tests/typescript.test.ts` vers le CLI ;
3. fusionner les deux implémentations de `propertyKey` ;
4. fusionner les deux implémentations de `docCommentOf` ;
5. préserver les tests de sécurité empêchant une description ou un nom de produire du code actif ;
6. mettre à jour `SyncHandler` pour importer les classes localement ;
7. retirer leurs exports et leurs types associés de `@fougere/schema` ;
8. retirer les deux fichiers de `packages/schema` ;
9. vérifier les usages restants de `upperFirst`, sans le supprimer s'il possède encore d'autres
   lecteurs.

Le paquet étant en alpha, ne pas ajouter de réexport déprécié. Le déplacement doit terminer la
responsabilité, pas créer une couche de compatibilité permanente.

### Invariants spécifiques

- le source d'entité généré reste byte-identique ;
- le source de façade généré reste byte-identique ;
- les noms TypeScript invalides restent refusés ;
- `*/` dans une description ne peut toujours pas sortir d'un commentaire ;
- le descripteur inclus dans le source reste une donnée JSON non altérée ;
- le CLI produit les mêmes fichiers de synchronisation.

### Hors périmètre du lot 2

- ne pas déplacer `Cases` ;
- ne pas déplacer `RowRefusal` ;
- ne pas créer de sous-chemin public ;
- ne pas modifier `Card`, `Bundle` ou leurs descripteurs ;
- ne pas refondre les utilitaires génériques du paquet.

### Vérifications du lot 2

```sh
pnpm --filter @fougere/schema test
pnpm --filter @fougere/schema typecheck
pnpm --filter @fougere/cli test
pnpm --filter @fougere/cli typecheck
pnpm arch:cycles
```

## Lot 3 — Canonicaliser l'unicité composite

### Objectif

Faire appartenir une contrainte unique composite au schéma qu'elle contraint, au lieu de la copier
sur chacun de ses champs membres.

Ce lot est le seul chantier de représentation interne retenu.

### Représentation cible

Conserver la distinction naturelle suivante :

- une unicité simple appartient au champ et se représente comme un booléen dans son rôle ;
- une unicité composite appartient au schéma et se représente une seule fois dans
  `SchemaDefinition`.

Une forme possible est :

```ts
interface RoleRules {
  primary?: boolean;
  index?: boolean;
  unique?: boolean;
  relation?: Relation;
}

interface SchemaConstraints<TFields extends Fields> {
  unique?: readonly (readonly FieldName<TFields>[])[];
}
```

`getUnique()` reste la question canonique pour les groupes composites. Son comportement observable
reste le même : il ne rend pas les unicités simples.

Ajouter à `Role` une question explicite pour l'unicité simple, par exemple `isUnique`, afin qu'un
lecteur ne connaisse ni une sentinelle ni la représentation de stockage.

### Normalisation à la déclaration

`unique(field)` doit poser `role.unique = true` sans attendre de connaître le nom du champ.

Une déclaration d'entité `unique: [...]` est normalisée ainsi :

- un groupe d'un membre devient `role.unique = true` sur ce champ ;
- un groupe de plusieurs membres rejoint les contraintes de `SchemaDefinition` ;
- un membre inconnu reste refusé à la porte de l'entité ;
- deux déclarations équivalentes ne doivent pas produire deux contraintes.

Après cette normalisation, aucun `FieldGroup` composite n'est stocké dans les champs.

**La sentinelle disparaît avec, et c'est le gain principal du lot.** Aujourd'hui `unique()` écrit
`new Unique([])` — un groupe *vide*, en attente d'apprendre le nom du champ sous lequel il a été
déclaré. Toute une machinerie existe pour le lui apprendre après coup : `FieldGroup.isSelf`,
`FieldGroup.resolvedOn`, `Role.resolvedOn`, et quatre sites qui résolvent cette attente —
`RoleAxis` à l'écriture de carte, `adapter/sql/src/table.ts`, et un test de `adapter/rest`.

Dès lors que `unique(field)` pose `role.unique = true` immédiatement, plus aucun groupe vide
n'existe, `resolvedOn` devient un no-op partout, et l'ensemble est supprimable. C'est un critère
de réussite du lot, pas un effet de bord : si cette machinerie survit au lot 3, le lot a déplacé
une représentation sans retirer la raison qui l'avait rendue nécessaire.

### Dérivations

`SchemaDefinition` transforme chaque groupe composite une seule fois :

- `pick` et `omit` suppriment tout groupe dont un membre disparaît ;
- `rename` renomme chaque membre ;
- une opération sans effet conserve l'identité logique du groupe ;
- `partial`, `extend` et `anchor` conservent les groupes existants ;
- `compose`, tant qu'il existe, applique sa loi de fusion documentée aux contraintes.

Les tests existants de `adapter/sql/tests/composite-unique.test.ts` conservent leurs attentes.

### Adaptation des lecteurs

Trois lecteurs hors de `packages/schema` doivent cesser de connaître `FieldGroup` et `Unique` :

1. `core/src/boot/frame.ts` pose uniquement la question « existe-t-il une contrainte unique autre
   que la clé primaire ? ». Lui fournir le schéma ou une question dédiée plutôt qu'un ensemble de
   champs contenant des groupes cachés ;
2. `adapter/sql/src/table.ts` lit `Role.of(field).isUnique` pour les contraintes de colonne et
   `schema.getUnique()` pour les contraintes composites de table ;
3. le test de `adapter/rest` vérifie le contrat public ou le round-trip, jamais les classes internes
   `FieldGroup` et `Unique`.

À la fin du lot, `FieldGroup` et `Unique` ne doivent plus faire partie de l'API publique. S'ils ne
servent plus de sentinelle interne, les supprimer entièrement.

### Compatibilité de la carte v1

Le modèle interne change, pas le wire.

À l'écriture :

- une unicité simple continue d'être décrite sous la forme attendue par la carte v1 ;
- un groupe composite canonique est projeté sur les propriétés membres exactement comme aujourd'hui ;
- le JSON produit par les fixtures dorées du lot 1 reste identique.

À la lecture :

- les groupes v1 d'un membre redeviennent `role.unique = true` ;
- les groupes v1 de plusieurs membres sont collectés et dédupliqués dans `SchemaDefinition` ;
- les groupes composites ne restent pas attachés aux champs reconstruits ;
- une carte mal formée reste refusée avec le même niveau de précision.

Cette conversion appartient au codec de `Card`. Elle ne justifie ni un format v2, ni un déplacement
des axes, ni une nouvelle famille de modules.

### Hors périmètre du lot 3

- aucune modification du format wire ;
- aucune refonte générale de `SchemaView` ;
- aucune suppression des accesseurs `get*` ;
- aucune modification des cycles déclarés ;
- aucune conversion des juges en fonctions ;
- aucune réorganisation générale des axes ;
- aucun changement de comportement de `pick`, `omit` ou `rename` ;
- aucun changement du choix SQL entre contrainte de colonne et contrainte de table.

### Vérifications du lot 3

```sh
pnpm --filter @fougere/schema test
pnpm --filter @fougere/schema typecheck
pnpm --filter @fougere/core test
pnpm --filter @fougere/core typecheck
pnpm --filter @fougere/adapter-sql test
pnpm --filter @fougere/adapter-sql typecheck
pnpm --filter @fougere/adapter-rest test
pnpm --filter @fougere/adapter-rest typecheck
pnpm arch:cycles
```

Comparer également toutes les fixtures wire v1 ajoutées au lot 1.

## Discipline d'exécution

- un lot correspond à un commit ;
- **un lot qui retire un export publié pose un changeset** — le dépôt est en mode `pre`, tag
  `alpha`, et `@fougere/schema` est publié en `0.6.0-alpha.0`. Cela concerne le lot 2
  (`EntityTypeSource`, `FacadeTypeSource` et leurs types) et le lot 3 (`FieldGroup`, `Unique`).
  `pnpm changeset`, dans le commit du lot, pas après ;
- terminer et présenter le lot 1 avant de commencer le lot 2 ;
- terminer et présenter le lot 2 avant de commencer le lot 3 ;
- ne jamais mélanger une décision de contrat, un déplacement et une nouvelle représentation ;
- tout nouveau contenu destiné au dépôt est écrit en anglais ;
- ne pas réécrire les commentaires hors périmètre ;
- un commentaire énonce l'invariant en une ou deux lignes ;
- ne citer aucun numéro de ligne dans un commentaire ou un message de commit ;
- ne jamais utiliser `git add -A`, car d'autres sessions travaillent dans cet arbre ;
- les messages de commit portent l'intention en un titre et une à trois lignes de corps ;
- ne pas commencer le lot suivant sans validation explicite après le compte rendu du précédent.

## Mandat immédiat à Claude

Implémenter uniquement le lot 1.

Ne commencer ni le déplacement du codegen ni l'unicité composite pendant ce travail. À la fin,
retourner le compte rendu demandé sous « Retour attendu après le lot 1 » et attendre la validation
avant toute suite.
