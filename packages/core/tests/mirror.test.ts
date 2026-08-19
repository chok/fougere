/**
 * Mirror(Shape) — the loop, the age, the judge and the write, so an author writes one
 * generator and nothing else.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, updated } from '@fougere/schema';
import { Mirror, ageFieldOf } from '../src/prefab/mirror.js';
import { targetOf } from '../src/prefab/prefab.js';

class Card extends entity({ id: primary(), title: text({ min: 1 }), pulledAt: updated() }) {}

/** An ORM that records what it was handed — a mirror only ever uses two gestures. */
function spyOrm(rows: Record<string, unknown>[] = []) {
  const written: Record<string, unknown>[][] = [];
  return {
    written,
    list: async (o: any) => (o?.orderBy ? [...rows].sort((a: any, b: any) => b[o.orderBy] - a[o.orderBy]).slice(0, o.limit) : rows),
    upsertAll: async (page: any[]) => { written.push(page); return page.length; },
  } as never;
}

describe('a mirror refreshes', () => {
  it('writes every page and reports the pass', async () => {
    const orm = spyOrm();
    class M extends Mirror(Card) {
      async *pull() { yield [{ id: 'a', title: 'A' }]; yield [{ id: 'b', title: 'B' }]; }
    }
    const done = await new M(orm).refresh();

    expect(done.written).toBe(2);
    expect((orm as any).written).toHaveLength(2);
    expect(done.since).toBeUndefined();     // nothing stored yet
    expect(done.ms).toBeGreaterThanOrEqual(0);
  });

  it('hands the pull its own high-water mark — which is what makes it incremental', async () => {
    const pulled = new Date('2026-01-01T00:00:00.000Z');
    const orm = spyOrm([{ id: 'a', title: 'A', pulledAt: pulled }]);
    let asked: Date | undefined = new Date(0);
    class M extends Mirror(Card) {
      async *pull(since?: Date) { asked = since; yield []; }
    }
    await new M(orm).refresh();

    // Read off the table and not remembered here: another process may have refreshed it.
    expect(asked).toEqual(pulled);
  });

  it('refuses a row that does not match the shape, naming it and every field', async () => {
    const orm = spyOrm();
    class M extends Mirror(Card) {
      async *pull() { yield [{ id: 'P-0', titre: 'oups' } as never]; }
    }
    await expect(new M(orm).refresh())
      .rejects.toThrow(/Card mirror refused row id "P-0" — titre: Unknown field, title: Required/);
    // And nothing of that page was written.
    expect((orm as any).written).toHaveLength(0);
  });

  // Found by demos/mirror-catalog: the key was read as `row.id`, so every shape keyed on
  // anything else fell back to "row 3 of this page" — a position, in an import of
  // thousands, pointing at nothing an operator can look up on the other side.
  it('names a refused row by the key its SHAPE declares, not `id`', async () => {
    class Book extends entity({ isbn: primary(), title: text({ min: 1 }), pulledAt: updated() }) {}
    class M extends Mirror(Book) {
      async *pull() { yield [{ isbn: '978-0', title: '' } as never]; }
    }
    await expect(new M(spyOrm()).refresh())
      .rejects.toThrow(/Book mirror refused row isbn "978-0" —/);
  });

  it('writes what the judge PARSED, not what the caller handed over', async () => {
    const orm = spyOrm();
    class M extends Mirror(Card) {
      async *pull() { yield [{ id: 'a', title: 'A' }]; }
    }
    await new M(orm).refresh();
    // The page written is the judge's output — the door a boundary would decode at.
    expect((orm as any).written[0][0]).toEqual({ id: 'a', title: 'A' });
  });

  it('skips an empty page rather than issuing a statement for nothing', async () => {
    const orm = spyOrm();
    class M extends Mirror(Card) {
      async *pull() { yield []; yield [{ id: 'a', title: 'A' }]; }
    }
    expect((await new M(orm).refresh()).written).toBe(1);
    expect((orm as any).written).toHaveLength(1);
  });
});

describe('what a mirror states about itself', () => {
  it('names the shape it copies, at runtime — an installed app resolves no AST', () => {
    class M extends Mirror(Card) { async *pull() { yield []; } }
    expect(targetOf(M)).toBe(Card);
  });

  it('finds the field a copy states its age with', () => {
    expect(ageFieldOf(Card)).toBe('pulledAt');
    class Undated extends entity({ id: primary(), title: text() }) {}
    expect(ageFieldOf(Undated)).toBeUndefined();
  });

  it('refuses a shape that cannot say its age, at the declaration', () => {
    // The DDL states this for a stored DERIVATION; an entity used as a mirror — a flat
    // search index copying rather than referencing — reaches no such rule.
    class Undated extends entity({ id: primary(), title: text() }) {}
    expect(() => Mirror(Undated)).toThrow(/carries no `updated\(\)` field/);
  });
});
