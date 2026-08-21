# test-gradient

Ce que la déclaration écrit toute seule, et les trois crans où on l'exécute.

```bash
pnpm test          # les trois premiers crans
pnpm e2e           # le quatrième : un vrai navigateur (playwright démarre le serveur)
pnpm dev           # la page seule, sur :4300
pnpm load:gen      # réécrit load.js depuis ce que l'app répond
k6 run load.js     # si k6 est installé
```

**40 tests.** Trente-cinq d'entre eux viennent d'un fichier de **huit lignes** ; les cinq
autres sont les seuls écrits à la main, et ils disent ce qu'aucune déclaration ne peut
deviner — ce que fait un handler, et ce qu'un port bouché doit répondre.

## Cran 1 — un frond

`fronds/catalog/tests/pricing.test.ts`. Le fichier est dans le frond, et ça suffit :

```ts
await using app = await testApp()          // aucun argument
expect(app.fronds.map(f => f.name)).toEqual(['catalog'])
```

La position dit le projet et dit le sujet, comme `entities/` dit déjà ce qu'un dossier
contient. Le frond `orders` n'est pas monté — le même énoncé que `remotes:` en production.

C'est aussi le cran où un port se bouche, parce qu'un taux est un fait sur le monde
extérieur et pas sur le catalogue :

```ts
await using app = await testApp({ stub: [Pricing] })
app.stub(Pricing).total.mockReturnValue(4242)
```

Les méthodes du bouchon viennent du prototype du port, jamais d'une liste écrite à la
main. Ce qu'il RENVOIE, en revanche, est à toi : le type de retour d'un service est un
type TypeScript nu, effacé à l'exécution.

## Cran 2 — plusieurs fronds

`tests/contracts.test.ts`, au-dessus des fronds, donc les deux sont réels. Le fichier
entier :

```ts
const app = await testApp()
checkContract(app, Product); checkOutput(app, Product)
checkContract(app, Order);   checkOutput(app, Order)
```

Aucun cas n'est écrit. Ils sont énumérés depuis les champs — `sku trop court`,
`cents au-dessus du maximum`, `status hors de l'ensemble`, `clé hors contrat`,
`corps qui n'est pas un objet`. Tu changes un `min:` dans l'entité, les cas suivent.

Ça marche parce que le juge a une liste **fermée** de refus : champ inconnu, champ
manquant, lecture seule, immuable, la forme, un codec nommé. Avec un validateur où l'on
écrit du code de règle libre, c'est impossible.

## Cran 3 — l'app dans son process

`tests/split.test.ts`. Le test parle par le transport qui fait déjà marcher un frond
déplacé — il devient un consommateur, comme un navigateur posé à côté.

Playwright n'a pas d'objet ici : cette démo n'a pas de front. Le cran navigateur se
montre là où il y a des pages.

## La charge

`load.js` est **généré**, pas écrit. Il couvre les onze opérations que l'app répond, avec
un corps valide pour chacune, et son enveloppe JSON-RPC vient de `frameCall` — pas d'une
copie qui mentira le jour où le format bouge.

Ce qui reste à écrire : les poids, les paliers et les seuils. Le scan sait quelles
opérations existent ; il ne sait rien du trafic qu'elles reçoivent.

## Cran 4 — un navigateur

`e2e/catalog.spec.ts` et `server.ts`. Le formulaire n'est écrit nulle part :
`formFieldsOf` le dérive de `Product`, avec ses contraintes sous les noms que le navigateur
connaît déjà.

```html
<input id="sku" name="sku" type="text" required minlength="3" maxlength="12">
<select id="status"><option>draft</option><option>listed</option><option>withdrawn</option></select>
```

Ce que ce cran prouve et qu'aucun autre ne peut : **la page n'énonce aucune règle de son
côté.** Elle ne contient pas une ligne de validation — un `sku` de deux caractères est
refusé par le navigateur, et le même corps envoyé directement à la porte est refusé par le
juge. « Juge local = juge distant » se regarde ici au lieu de se plaider ; les autres crans
ne peuvent que le simuler dans un seul process.
