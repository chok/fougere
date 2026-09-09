/**
 * The ordering states what no order satisfies.
 *
 * A `ref()` cycle has no order that plants every seed. `orderSeeds` used to append its members
 * in declaration order and say nothing, so the caller read a foreign-key error from the driver
 * about a cycle the boot had already found. A nullable back-reference makes a cycle that IS seedable —
 * so this is named, not refused.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, ref, text, type EntityConstructor } from '@fougere/schema';
import { orderSeeds } from '../src/boot/seed.js';
import type { EntityEntry, FrondDescriptor, SeedEntry } from '../src/descriptor/frond.js';

class Tag extends entity({ id: primary(), label: text() }) {}
class Note extends entity({ id: primary(), body: text(), tag: ref(Tag) }) {}

// A circular relation wants the thunk's return annotated, or the two base expressions
// wait on each other — `schema/demo/06-circular-relations.ts` states the rule.
class Author extends entity({ id: primary(), name: text(), latest: ref((): EntityConstructor => Post) }) {}
class Post extends entity({ id: primary(), title: text(), author: ref(Author) }) {}

const held: Record<string, unknown> = { tag: Tag, note: Note, author: Author, post: Post };

function frond(names: string[]): FrondDescriptor {
  const seeds: SeedEntry[] = names.map((name) => ({ entityName: name, data: [], filePath: `${name}.seed.ts` }));
  const entities = Object.entries(held).map(([name, entityClass]) => ({
    name, entityClass, filePath: `${name}.ts`,
  })) as EntityEntry[];

  return {
    name: 'blog',
    source: { path: '/blog' } as FrondDescriptor['source'],
    providers: [], handlers: [], presenters: [], collectors: [],
    entities,
    seeds,
  };
}

const named = (seeds: SeedEntry[]) => seeds.map((seed) => seed.entityName);

describe('the seed ordering', () => {
  it('plants a ref() target before its referrer', () => {
    const { ordered, cycle } = orderSeeds([frond(['note', 'tag'])]);

    expect(named(ordered)).toEqual(['tag', 'note']);
    expect(cycle).toEqual([]);
  });

  it('waits for nothing an entity does not reference', () => {
    const { ordered, cycle } = orderSeeds([frond(['tag'])]);

    expect(named(ordered)).toEqual(['tag']);
    expect(cycle).toEqual([]);
  });

  it('does not wait on a target nobody seeds', () => {
    // `note` refs `tag`; with no tag seed, whatever put those rows there already satisfied it.
    const { ordered, cycle } = orderSeeds([frond(['note'])]);

    expect(named(ordered)).toEqual(['note']);
    expect(cycle).toEqual([]);
  });

  it('names the members of a cycle instead of ordering them', () => {
    const { ordered, cycle } = orderSeeds([frond(['author', 'post'])]);

    expect(ordered).toEqual([]);
    expect(named(cycle).sort()).toEqual(['author', 'post']);
  });

  it('keeps what it could order beside what it could not', () => {
    const { ordered, cycle } = orderSeeds([frond(['note', 'tag', 'author', 'post'])]);

    expect(named(ordered)).toEqual(['tag', 'note']);
    expect(named(cycle).sort()).toEqual(['author', 'post']);
  });
});
