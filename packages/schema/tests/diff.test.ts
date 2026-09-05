import { describe as group, it, expect } from 'vitest';
import { entity, text, number, primary, optional, date, readOnly, created, indexed } from '../src/index.js';
import { Bundle } from '../src/projection/card/Bundle.js';
import { Card } from '../src/projection/card/Card.js';
import { type Change } from '../src/projection/card/diff.js';

/** Two shapes, as `fougere freeze` would have written them a year apart. */
const shapeOf = (fields: Parameters<typeof entity>[0]) => Card.fromSchema(class extends entity(fields) {}, 'post');

const V1 = shapeOf({
  id: primary(),
  title: text(),
  body: text(),
});

const kinds = (changes: Change[]) => changes.map((c) => c.kind).sort();

group('what separates two shapes', () => {
  it('finds nothing between a shape and itself', () => {
    expect(V1.diff(V1)).toEqual({ changes: [], ambiguous: [] });
  });

  it('reports a field that appeared, and whether it must be filled', () => {
    const V2 = shapeOf({ id: primary(), title: text(), body: text(), slug: text() });

    expect(V1.diff(V2).changes).toEqual([
      { kind: 'added', field: 'slug', to: expect.anything(), required: true },
    ]);
  });

  it('an added OPTIONAL field is not the same news', () => {
    // The boot check turns on exactly this: an old writer can satisfy one and not the other.
    const V2 = shapeOf({ id: primary(), title: text(), body: text(), slug: optional(text()) });
    const [change] = V1.diff(V2).changes;

    expect(change).toMatchObject({ kind: 'added', field: 'slug', required: false });
  });

  it('reports a field that left', () => {
    const V2 = shapeOf({ id: primary(), title: text() });

    expect(V1.diff(V2).changes).toEqual([
      { kind: 'removed', field: 'body', from: expect.anything(), required: true },
    ]);
  });

  it('reports a type that moved', () => {
    const V2 = shapeOf({ id: primary(), title: text(), body: number() });
    const [change] = V1.diff(V2).changes;

    expect(change).toEqual({ kind: 'retyped', field: 'body', from: ['string'], to: ['number'] });
  });

  it('reads a field becoming nullable as a type change, because that is what it is', () => {
    const V2 = shapeOf({ id: primary(), title: text(), body: optional(text()) });

    // A card folds nullable into a union, so the set grows, and the requirement drops.
    // `optional()` moves the lifecycle too, and both are reported: one declaration touching
    // two axes is two differences, and hiding either would be a reader's decision to make.
    expect(kinds(V1.diff(V2).changes)).toEqual(['required', 'restated', 'retyped']);
  });

  it('separates bounds from type — a CHECK moves, the column does not', () => {
    const V2 = shapeOf({ id: primary(), title: text({ max: 100 }), body: text() });
    const [change] = V1.diff(V2).changes;

    expect(change).toMatchObject({ kind: 'reshaped', field: 'title' });
  });

  it('says nothing when only the sentence changed — SQL reads `reshaped` as a bound that moved', () => {
    const before = shapeOf({ id: primary(), title: text({ description: 'Old' }) });
    const after = shapeOf({ id: primary(), title: text({ description: 'New' }) });

    expect(before.diff(after).changes).toEqual([]);
  });

  it('says nothing about a date beyond its own axis', () => {
    const before = shapeOf({ id: primary(), at: date() });
    const after = shapeOf({ id: primary(), at: date() });

    expect(before.diff(after).changes).toEqual([]);
  });
});

group('a rename is declared, never guessed', () => {
  const V2 = shapeOf({ id: primary(), title: text(), content: text() });

  it('reports the pair and decides nothing on its own', () => {
    // `body` gone and `content` appeared. Same shape, so it COULD be a rename — and the
    // two readings produce opposite DDL, one keeping the column's data and one dropping it.
    const answer = V1.diff(V2);

    expect(answer.ambiguous).toEqual([{ removed: 'body', added: 'content' }]);
    expect(kinds(answer.changes)).toEqual(['added', 'removed']);
  });

  it('takes the declaration and the ambiguity is gone', () => {
    const answer = V1.diff(V2, { renamed: { body: 'content' } });

    expect(answer.ambiguous).toEqual([]);
    expect(answer.changes).toEqual([
      { kind: 'renamed', from: 'body', to: 'content', field: expect.anything() },
    ]);
  });

  it('a rename AND a type change read as two changes, not as a drop-and-add', () => {
    const V3 = shapeOf({ id: primary(), title: text(), content: number() });
    const answer = V1.diff(V3, { renamed: { body: 'content' } });

    expect(kinds(answer.changes)).toEqual(['renamed', 'retyped']);
    expect(answer.ambiguous).toEqual([]);
  });

  it('pairs nothing when the shapes differ — that is a removal and an addition', () => {
    const V3 = shapeOf({ id: primary(), title: text(), views: number() });

    expect(V1.diff(V3).ambiguous).toEqual([]);
  });

  it('reports every candidate rather than picking the likeliest', () => {
    // Two fields of the same shape appeared: both are reported, and neither is applied.
    const V3 = shapeOf({ id: primary(), title: text(), content: text(), excerpt: text() });
    const answer = V1.diff(V3);

    expect(answer.ambiguous).toEqual([
      { removed: 'body', added: 'content' },
      { removed: 'body', added: 'excerpt' },
    ]);
  });

  it('offers the nearest candidate first — the order ranks, it never decides', () => {
    // `body` sat third and `content` sits third too, while `lede` opens the entity.
    // Both are still reported; the one that did not move is proposed first.
    const V4 = shapeOf({ lede: text(), id: primary(), title: text(), content: text() });

    expect(V1.diff(V4).ambiguous).toEqual([
      { removed: 'body', added: 'content' },
      { removed: 'body', added: 'lede' },
    ]);
  });
});

group('what the readers will ask it', () => {
  it('a version that can no longer write is visible in the changes alone', () => {
    // The boot refusal: v2 requires a field v1 never knew, and no old caller can fill it.
    const V2 = shapeOf({ id: primary(), title: text(), body: text(), author: text() });
    const blocking = V1.diff(V2).changes.filter((c) => c.kind === 'added' && c.required);

    expect(blocking).toHaveLength(1);
  });

  it('the direction is the instruction — reversing it reverses the news', () => {
    const V2 = shapeOf({ id: primary(), title: text(), body: text(), slug: text() });

    expect(V1.diff(V2).changes[0].kind).toBe('added');
    expect(V2.diff(V1).changes[0].kind).toBe('removed');
  });
});

group('two sets of entities — what a freeze actually compares', () => {
  const bundleOf = (cards: Record<string, ReturnType<typeof shapeOf>>) => Bundle.fromDescriptor({
    $defs: Object.fromEntries(Object.entries(cards).map(([name, card]) => [name, card.descriptor])),
    'x-fougere-version': 1 as const,
    'x-fougere-vendor': 'fougere' as const,
  });

  const AUTHOR = shapeOf({ id: primary(), email: text() });

  it('says nothing about an entity that did not move', () => {
    const answer = bundleOf({ post: V1, author: AUTHOR }).diff(bundleOf({ post: V1, author: AUTHOR }));

    expect(answer).toEqual({ entitiesAdded: [], entitiesRemoved: [], entities: {} });
  });

  it('names an entity that appeared and one that left', () => {
    const answer = bundleOf({ post: V1 }).diff(bundleOf({ author: AUTHOR }));

    expect(answer.entitiesAdded).toEqual(['author']);
    expect(answer.entitiesRemoved).toEqual(['post']);
  });

  it('reports only the entities that differ, and keeps their ambiguity', () => {
    const V2 = shapeOf({ id: primary(), title: text(), content: text() });
    const answer = bundleOf({ post: V1, author: AUTHOR }).diff(bundleOf({ post: V2, author: AUTHOR }));

    expect(Object.keys(answer.entities)).toEqual(['post']);
    expect(answer.entities.post.ambiguous).toEqual([{ removed: 'body', added: 'content' }]);
  });

  it('takes the declaration per entity', () => {
    const V2 = shapeOf({ id: primary(), title: text(), content: text() });
    const answer = bundleOf({ post: V1 }).diff(
      bundleOf({ post: V2 }),
      { renamed: { post: { body: 'content' } } },
    );

    expect(answer.entities.post.ambiguous).toEqual([]);
    expect(kinds(answer.entities.post.changes)).toEqual(['renamed']);
  });
});

group('the three axes a JSON Schema reader cannot see', () => {
  const axesOf = (changes: Change[]) =>
    changes.filter((c) => c.kind === 'restated').map((c) => (c as Extract<Change, { kind: 'restated' }>).axis);

  it('reports an index that appeared', () => {
    const V2 = shapeOf({ id: primary(), title: indexed(text()), body: text() });

    expect(V1.diff(V2).changes).toEqual([
      { kind: 'restated', field: 'title', axis: 'role', from: undefined, to: { index: true } },
    ]);
  });

  it('reports a unique group that moved', () => {
    const V2 = Card.fromSchema(
      class extends entity({ id: primary(), title: text(), body: text() }, { unique: [['title', 'body']] }) {},
      'post',
    );

    expect(axesOf(V1.diff(V2).changes)).toEqual(['role', 'role']);
  });

  it('reports a boundary that closed — the one change no table would show', () => {
    const V2 = shapeOf({ id: primary(), title: text(), body: readOnly(text()) });

    expect(axesOf(V1.diff(V2).changes)).toEqual(['boundary']);
  });

  it('reports a lifecycle that gained a stamp', () => {
    const V2 = shapeOf({ id: primary(), title: text(), body: text(), at: created() });

    // The field is new, so its axes ride in with it — nothing is `restated` about it.
    expect(kinds(V1.diff(V2).changes)).toEqual(['added']);
  });

  it('says nothing when every axis stands still', () => {
    expect(V1.diff(shapeOf({ id: primary(), title: text(), body: text() })).changes).toEqual([]);
  });
});
