/**
 * Demo 6 — Relations circulaires (le cas du thunk)
 *
 * `entity({...})` évalue son argument TOUT DE SUITE, à la définition de la classe.
 * Donc une relation vers une classe déclarée plus bas dans le MÊME fichier ne peut
 * pas recevoir la classe directement — elle n'existe pas encore :
 *
 *     class Author extends entity({ posts: many(Post) }) {}  // ❌ Post pas encore défini
 *     class Post   extends entity({ authorId: ref(Author) }) {}
 *     // ReferenceError: Cannot access 'Post' before initialization
 *
 * La solution : passer la cible en THUNK `() => Cible`. Le thunk n'est appelé que
 * plus tard (quand un adapter résout la relation), donc la classe est définie à ce
 * moment-là. C'est la même approche que Kysely / Pothos / TypeORM.
 *
 * Le thunk suffit au runtime, mais pas au compilateur : pour typer `many(() => Post)`
 * il faut typer `Post`, dont l'expression de base demande `Author`, qui demande
 * `Post`. TypeScript refuse le cycle (TS2506) et les deux classes perdent
 * `getFields()`. Annoter le retour du thunk arrête l'inférence là :
 * `many((): EntityConstructor => Post)`. Aucune autre forme ne le casse — mesuré,
 * une surcharge de `many` échoue de la même façon, parce que le cycle est dans
 * l'inférence du thunk et non dans le type de retour.
 *
 * Règle simple :
 * - cible déjà déclarée au-dessus  → forme directe `ref(Author)`
 * - cible déclarée plus bas → thunk `many(() => Post)`
 * - relation circulaire → thunk annoté `many((): EntityConstructor => Post)`
 */
import { entity, primary, text, ref, many, type EntityConstructor } from "../src/index.js";

// Author référence Post, qui est déclaré APRÈS → thunk obligatoire, et annoté
// parce que Post référence Author en retour.
class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
  posts: many((): EntityConstructor => Post),
}) {}

// Post référence Author, déjà déclaré au-dessus → forme directe possible.
class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  authorId: ref(Author),
}) {}

// Les deux sens de la relation se résolvent (le thunk est appelé ici, après définition).
const authorPosts = Author.getFields().posts.role!.relation!;
const postAuthor = Post.getFields().authorId.role!.relation!;

console.log("--- Author.posts ---");
console.log(`  kind: ${authorPosts.kind}`); // many
console.log(`  → ${authorPosts.to().name}`); // Post

console.log("\n--- Post.authorId ---");
console.log(`  kind: ${postAuthor.kind}`); // one
console.log(`  → ${postAuthor.to().name}`); // Author

console.log(
  "\nLa relation circulaire Author ⇄ Post est résolue, sans erreur de TDZ.",
);
