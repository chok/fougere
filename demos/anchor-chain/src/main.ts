/**
 * A path with two stops.
 *
 * Every schema here comes from `Post`, and only two of the four hold rows. The word that
 * separates them is `.anchor()`, and the two walks it makes possible do NOT have the same
 * length: whose rows stops at the nearest anchor, what it was cut from keeps going.
 */
import { entity, primary, text, created } from '@fougere/schema';
import { toTables, createTableSQL } from '@fougere/adapter-sql';

class Post extends entity({
  id: primary(),
  slug: text(),
  title: text(),
  body: text(),
  publishedAt: created(),
}) {}

/** A shape of Post's rows. Says nothing, so it holds nothing. */
class PostCard extends Post.pick('id', 'slug', 'title') {}

/** Its own rows, and it has to say so: it kept every field of `Post`. */
class ArchivedPost extends Post.extend({ archivedBy: text(), archivedAt: created() }).anchor() {}

/** A shape of ArchivedPost's rows — cut from an anchor, so it answers for that one. */
class ArchivedCard extends ArchivedPost.pick('id', 'title', 'archivedBy') {}

const app = {
  fronds: [{
    name: 'blog',
    entities: [
      { name: 'Post', entityClass: Post },
      { name: 'PostCard', entityClass: PostCard },
      { name: 'ArchivedPost', entityClass: ArchivedPost },
      { name: 'ArchivedCard', entityClass: ArchivedCard },
    ],
  }],
};

const line = (title: string) => console.log(`\n\x1b[1m${title}\x1b[0m`);
const say = (left: string, right: string) => console.log(`  ${left.padEnd(16)} ${right}`);

line('Who holds rows');
for (const [name, schema] of Object.entries({ Post, PostCard, ArchivedPost, ArchivedCard })) {
  const derived = schema.derivation ? `cut from ${schema.derivation.sourceName}` : 'declared outright';
  say(name, schema.anchored || !schema.derivation ? `anchor      (${derived})` : `answer      (${derived})`);
}

line('Where the walk stops — whose rows a shape describes');
say('PostCard', `${PostCard.derivation!.anchor.name}`);
say('ArchivedCard', `${ArchivedCard.derivation!.anchor.name}`);
console.log('  ArchivedCard stops at ArchivedPost and never reaches Post: those are two tables.');
console.log('  It says whose rows, not how to address them — an anchor may carry no key at all.');

line('Where provenance keeps going — what this shape was cut from');
const chain = (schema: { derivation?: { sourceName: string; source: any } }): string[] =>
  schema.derivation ? [schema.derivation.sourceName, ...chain(schema.derivation.source)] : [];
say('ArchivedCard', ['ArchivedCard', ...chain(ArchivedCard)].join(' → '));
console.log('  Two walks over one field, and only one of them stops at the first anchor.');

line('What SQL emits — an anchor is an entity, so it gets an entity\'s table');
for (const table of toTables(app as never, (name) => name.toLowerCase())) {
  console.log(`  ${createTableSQL(table, 'sqlite').replace(/\s+/g, ' ')}`);
}
console.log('  No foreign key between them: two anchors are two entities that share a shape,');
console.log('  never a hierarchy. A relation between them is `ref()`, declared like any other.');

line('A shape may widen too — nothing is asked of it');
class Excerpted extends Post.extend({ excerpt: text() }) {}
say('Excerpted', `${toTables({ fronds: [{ name: 'blog', entities: [{ name: 'Excerpted', entityClass: Excerpted }] }] } as never, (n) => n).length} table — a presenter fills \`excerpt\``);

line('An anchor need not be addressable — a key is a separate question');
class Membership extends entity({ userId: text(), groupId: text() }, { unique: [['userId', 'groupId']] }) {}
class MemberOf extends Membership.pick('userId') {}
for (const table of toTables({ fronds: [{ name: 'blog', entities: [{ name: 'Membership', entityClass: Membership }] }] } as never, (n) => n.toLowerCase())) {
  console.log(`  ${createTableSQL(table, 'sqlite').replace(/\s+/g, ' ')}`);
}
say('MemberOf', `answers ${MemberOf.derivation!.anchor.name} all the same`);

console.log();
