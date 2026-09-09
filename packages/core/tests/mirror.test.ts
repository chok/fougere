/**
 * Mirror(Shape) — the loop, the validator and the write, so an author writes one
 * generator and nothing else. The mark it pulls from is the caller's: a mirror that read
 * it off its own rows advanced past a pass that had thrown, and the rows the source had
 * changed in between were never asked for again.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, updated } from '@fougere/schema';
import { Mirror } from '../src/prefab/mirror.js';
import { StorageGuard } from '../src/dispatch/StorageGuard.js';
import { targetOf } from '../src/prefab/prefab.js';

class Card extends entity({ id: primary(), title: text({ min: 1 }), pulledAt: updated() }) {}

/**
 * A storage that records what it was handed — a mirror only ever uses two gestures.
 *
 * Guarded, because the one the boot injects is: the mirror declares `Storage<T>` and gets
 * the entity's own, judge and all. What a page must satisfy is not the prefab's rule.
 */
function spyStorage(shape: { getFields(): never } | unknown, rows: Record<string, unknown>[] = []) {
  const written: Record<string, unknown>[][] = [];
  const spy = {
    list: async (o: any) => (o?.orderBy ? [...rows].sort((a: any, b: any) => b[o.orderBy] - a[o.orderBy]).slice(0, o.limit) : rows),
    upsertAll: async (page: any[]) => { written.push(page); return page.length; },
    create: () => { throw new Error('a mirror writes pages'); },
    update: () => { throw new Error('a mirror writes pages'); },
  };
  const name = (shape as { name?: string }).name ?? 'mirror';

  return Object.assign(
    new StorageGuard((shape as { getFields(): never }).getFields(), name).guard(spy),
    { written },
  ) as never;
}

describe('a mirror refreshes', () => {
  it('writes every page and reports the pass', async () => {
    const storage = spyStorage(Card);
    class M extends Mirror(Card) {
      async *pull() { yield [{ id: 'a', title: 'A' }]; yield [{ id: 'b', title: 'B' }]; }
    }
    const done = await new M(storage).refresh();

    expect(done.written).toBe(2);
    expect((storage as any).written).toHaveLength(2);
    expect(done.since).toBeUndefined();     // nothing stored yet
    expect(done.ms).toBeGreaterThanOrEqual(0);
  });

  it('hands the pull the mark it was GIVEN, and reports it back', async () => {
    const mark = new Date('2026-01-01T00:00:00.000Z');
    const storage = spyStorage(Card, [{ id: 'a', title: 'A', pulledAt: new Date('2026-06-01T00:00:00.000Z') }]);
    let asked: Date | undefined = new Date(0);
    class M extends Mirror(Card) {
      async *pull(since?: Date) { asked = since; yield []; }
    }
    const done = await new M(storage).refresh(mark);

    // Never read off the rows: those carry when WE wrote them, not what the source
    // has changed since — and a pass that half-wrote would push the mark past its own gap.
    expect(asked).toEqual(mark);
    expect(done.since).toEqual(mark);
  });

  it('leaves the caller free to keep its mark where a failed pass cannot move it', async () => {
    const storage = spyStorage(Card);
    const asked: (Date | undefined)[] = [];
    let fail = true;
    class M extends Mirror(Card) {
      async *pull(since?: Date) {
        asked.push(since);
        yield [{ id: 'a', title: 'A' }];
        if (fail) { fail = false; throw new Error('source page failed'); }
      }
    }
    const mirror = new M(storage);
    let mark: Date | undefined;

    const pass = async () => {
      const startedAt = new Date();
      await mirror.refresh(mark);
      mark = startedAt;
    };
    await expect(pass()).rejects.toThrow(/source page failed/);
    await pass();

    // The second pass asked from the same place as the first — the throw skipped the
    // assignment, so nothing the source changed before it was stepped over.
    expect(asked).toEqual([undefined, undefined]);
  });

  it('refuses a key the shape does not declare — a mapping that went stale', async () => {
    const storage = spyStorage(Card);
    class M extends Mirror(Card) {
      async *pull() { yield [{ id: 'P-0', titre: 'oups' } as never]; }
    }
    await expect(new M(storage).refresh())
      .rejects.toThrow(/row id "P-0" — titre: Unknown field/);
    // And nothing of that page was written.
    expect((storage as any).written).toHaveLength(0);
  });

  // Found by demos/mirror-catalog: the key was read as `row.id`, so every shape keyed on
  // anything else fell back to "row 3 of this page" — a position, in an import of
  // thousands, pointing at nothing an operator can look up on the other side.
  it('names a refused row by the key its SHAPE declares, not `id`', async () => {
    class Book extends entity({ isbn: primary(), title: text({ min: 1 }), pulledAt: updated() }) {}
    class M extends Mirror(Book) {
      async *pull() { yield [{ isbn: '978-0', title: '' } as never]; }
    }
    await expect(new M(spyStorage(Book)).refresh())
      .rejects.toThrow(/row isbn "978-0" — title:/);
  });

  it('writes what the validator PARSED, not what the caller handed over', async () => {
    const storage = spyStorage(Card);
    class M extends Mirror(Card) {
      async *pull() { yield [{ id: 'a', title: 'A' }]; }
    }
    await new M(storage).refresh();
    // The page written is the validator's output — the door a boundary would decode at.
    expect((storage as any).written[0][0]).toEqual({ id: 'a', title: 'A' });
  });

  it('skips an empty page rather than issuing a statement for nothing', async () => {
    const storage = spyStorage(Card);
    class M extends Mirror(Card) {
      async *pull() { yield []; yield [{ id: 'a', title: 'A' }]; }
    }
    expect((await new M(storage).refresh()).written).toBe(1);
    expect((storage as any).written).toHaveLength(1);
  });
});

describe('what a mirror states about itself', () => {
  it('names the shape it copies, at runtime — an installed app resolves no AST', () => {
    class M extends Mirror(Card) { async *pull() { yield []; } }
    expect(targetOf(M)).toBe(Card);
  });

  it('copies a shape that dates nothing — the mark was never the rows\' to carry', async () => {
    class Undated extends entity({ id: primary(), title: text() }) {}
    class M extends Mirror(Undated) {
      async *pull() { yield [{ id: 'a', title: 'A' }]; }
    }
    expect((await new M(spyStorage(Undated)).refresh()).written).toBe(1);
  });
});
