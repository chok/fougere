/**
 * An adapter stands on the fields, not on the class.
 *
 * REST reads a schema for exactly two things — `inputFields` and `outputFields`.
 * Everything else (verbs, paths, op names, presenters) comes from the App. So a frond
 * whose class never crossed the wire must project the same routes from its card as a
 * local one does from its class. These tests hold that, and they are also where a new
 * axis that fails to travel shows up: the round-trip diff would stop being empty.
 */
import { describe as suite, it, expect, vi } from 'vitest';
import {
  entity, primary, text, email, number, bool, date, list, json,
  oneOf, ref, many, created, updated, immutable, optional, nullable,
  unique, indexed, readOnly, writeOnly,
  describe as describeCard, reconstruct, inputFields, outputFields, FieldGroup, Unique,
  type Fields,
} from '@fougere/schema';
import { generateRoutes } from '../src/index.js';

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
}) {}

/** Every word of the vocabulary — what does not travel shows up here first. */
class Post extends entity({
  id: primary(),
  slug: unique(text({ min: 1, max: 80 })),
  title: text({ min: 1, max: 160 }),
  summary: optional(text()),
  body: nullable(text()),
  contact: email(),
  views: indexed(number({ integer: true, min: 0 })),
  featured: bool({ default: false }),
  tags: list(text()),
  meta: json(),
  authorId: ref(Author),
  comments: many(Author),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  secret: writeOnly(text()),
  createdAt: created(),
  updatedAt: updated(),
  publishedAt: immutable(optional(date())),
}) {}

/**
 * What a consumer actually reads — the four axes in their wire form.
 *
 * Compared through JSON on purpose, and it is the strict comparison here rather than the
 * lenient one: the card's promise is about what SURVIVES serialisation. A live class
 * carries `maxLength: undefined` where the card omits the key, and a relation's `to` is a
 * different closure on each side. Neither crosses a wire, so neither is a difference a
 * consumer could observe — comparing object identity would test the wrong thing.
 */
const axesOf = (fields: Fields) =>
  JSON.parse(JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).map(([key, f]) => {
        const role = (f as any).role;
        return [key, {
          shape: (f as any).shape ?? null,
          // Self-references resolved before comparing: in memory a lone `unique()` holds
          // `[]` (no key to name yet), while one read back from a card holds `["slug"]`.
          // Same constraint whichever way it was stated — the group carries its members.
          role: role
            ? (() => {
                const groups = FieldGroup.on(f as never, Unique);
                const { rules: _rules, ...rest } = role;
                return groups.length
                  ? { ...rest, unique: groups.map((g) => g.resolvedOn(key).members) }
                  : rest;
              })()
            : null,
          lifecycle: (f as any).lifecycle ?? null,
          boundary: (f as any).boundary ?? null,
        }];
      }),
    ),
  )) as Record<string, unknown>;

function fakeApp(entityClass: unknown) {
  const facade = {
    list: vi.fn(async () => []),
    create: vi.fn(async (input: any) => input),
    update: vi.fn(async (input: any) => input),
  };
  return {
    fronds: [{
      name: 'blog',
      entities: [{ name: 'post', entityClass }],
      handlers: [],
      presenters: [],
    }],
    resolve: <T>() => facade as unknown as T,
    facadeFor: () => facade as Record<string, Function>,
  } as any;
}

suite('a card is a schema source', () => {
  it('carries every axis through describe → reconstruct', () => {
    const before = Post.getFields() as Fields;
    const after = reconstruct(describeCard(Post)).getFields() as Fields;

    expect(axesOf(outputFields(after))).toEqual(axesOf(outputFields(before)));
    expect(axesOf(inputFields(after))).toEqual(axesOf(inputFields(before)));
  });

  it('emits the same card again after a round-trip', () => {
    // Idempotence is the sharper statement: a card that rebuilds into a schema which
    // re-describes to the same document has lost nothing a second consumer could want.
    const once = describeCard(Post);
    expect(describeCard(reconstruct(once))).toEqual(once);
  });

  it('projects the same REST routes from a card as from the class', () => {
    const fromClass = generateRoutes(fakeApp(Post));
    const fromCard = generateRoutes(fakeApp(describeCard(Post)));

    expect(fromCard.map((r) => `${r.method} ${r.path}`))
      .toEqual(fromClass.map((r) => `${r.method} ${r.path}`));

    for (const [i, route] of fromCard.entries()) {
      const reference = fromClass[i]!;
      expect(route.inputFields && axesOf(route.inputFields))
        .toEqual(reference.inputFields && axesOf(reference.inputFields));
      expect(route.outputFields && axesOf(route.outputFields))
        .toEqual(reference.outputFields && axesOf(reference.outputFields));
    }
  });

  it('carries a composite unique — the fact no single field holds', () => {
    // `entity(fields, { unique: [[…]] })` is a fact about a PAIR: true of `(listId, docId)`
    // and of neither alone. It is stated on the entity and projected onto each member's
    // role, which is the form that crosses — a per-field boolean could not express it.
    class ListBook extends entity({
      id: primary(),
      listId: ref(Author),
      docId: text(),
    }, { unique: [['listId', 'docId']] }) {}

    expect(ListBook.getUnique()).toEqual([['listId', 'docId']]);

    const card = describeCard(ListBook);
    for (const member of ['listId', 'docId'] as const) {
      expect((card.properties[member]!['x-fougere'] as any).role.unique)
        .toEqual([['listId', 'docId']]);
    }

    // …and a consumer rebuilding it recovers the entity-level declaration, de-duplicated:
    // the card states the group once per member, the author wrote it once.
    const rebuilt = reconstruct(card);
    expect(rebuilt.getUnique()).toEqual([['listId', 'docId']]);
    expect(describeCard(rebuilt)).toEqual(card);
  });

  it('drops a group a derivation amputated, and keeps a whole one', () => {
    class ListBook extends entity({
      id: primary(),
      listId: ref(Author),
      docId: text(),
    }, { unique: [['listId', 'docId']] }) {}

    // `(listId)` alone says nothing about the pair — keeping the remnant would state a
    // stronger fact than the author wrote, so both the declaration and the projection go.
    const amputated = ListBook.pick('id', 'listId');
    expect(amputated.getUnique()).toBeUndefined();
    expect(amputated.getFields().listId!.role?.rules).toBeUndefined();
    // The rest of the role is untouched — dropping the group is not dropping the ref.
    expect((describeCard(amputated).properties.listId!['x-fougere'] as any).role)
      .toEqual({ relation: { to: 'author', kind: 'one' } });

    const whole = ListBook.pick('listId', 'docId');
    expect(whole.getUnique()).toEqual([['listId', 'docId']]);
  });
});
