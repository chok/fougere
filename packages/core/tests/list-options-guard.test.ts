import { describe, expect, it, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { StorageGuard } from '../src/dispatch/StorageGuard.js';
import type { ListOptions } from '../src/storage/port.js';

/**
 * The rule "an unknown key is refused" holds for the framework's own arguments too.
 *
 * The façade refuses an unknown key in a client's input (`Unknown field`). The read port
 * ignored its own: `list({ orderId })` was accepted, the criterion dropped, and a one-to-many
 * relation answered the whole table — the exact trap this repo names elsewhere, one level up.
 */
class Line extends entity({ id: primary(), label: text({ max: 5 }) }) {}

function guardedStorage() {
  // `list` declares its parameter: inspecting the options IS the guard's work, and
  // `StorageGuard.guard` hands back the type it was given — a double without a parameter
  // would make the calls below uncompilable. `Record` opens the door to the unknown keys,
  // which are precisely what these tests send.
  const list = vi.fn(async (_options?: ListOptions & Record<string, unknown>) => []);
  const storage = { list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) };
  return { storage, guarded: new StorageGuard(Line.getFields(), 'line').guard(storage) };
}

describe('the read options are judged', () => {
  it('refuses an option the port does not read', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ order_id: 'x' })).rejects.toThrow(/unknown option .*order_id/);
  });

  it('names the remedy in the message', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ order_id: 'x' })).rejects.toThrow(/where: \{ order_id/);
  });

  it('lets the known options through', async () => {
    const { storage, guarded } = guardedStorage();
    await guarded.list({ limit: 10, orderBy: 'id', where: { label: 'a' } });
    expect(storage.list).toHaveBeenCalled();
  });

  it('lets a call with no options through', async () => {
    const { storage, guarded } = guardedStorage();
    await guarded.list();
    expect(storage.list).toHaveBeenCalled();
  });

  it('refuses an orderBy the entity does not declare', async () => {
    const { guarded } = guardedStorage();
    // Without this refusal SQL dropped the sort and answered the page in whatever order
    // the engine chose: a paginated table that is wrong, and nothing to say so.
    await expect(guarded.list({ orderBy: 'labl' })).rejects.toThrow(/unknown orderBy .*labl/);
  });

  it('names the declared fields in the message', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ orderBy: 'labl' })).rejects.toThrow(/declares id, label/);
  });
});

describe('a filter on a field the door does not hand back', () => {
  it('says so without refusing — that is legal today', async () => {
    const said: string[] = [];
    const list = vi.fn(async (_o?: ListOptions & Record<string, unknown>) => []);
    const storage = { list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) };
    const guarded = new StorageGuard(Line.getFields(), 'line', {
      view: { id: Line.getFields().id },
      outOfView: (message) => said.push(message),
    }).guard(storage);

    await guarded.list({ where: { label: 'a' } });

    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/label/);
    expect(storage.list).toHaveBeenCalled();
  });

  it('says it once, not on every call', async () => {
    const said: string[] = [];
    const list = vi.fn(async (_o?: ListOptions & Record<string, unknown>) => []);
    const guarded = new StorageGuard(Line.getFields(), 'line', {
      view: { id: Line.getFields().id },
      outOfView: (message) => said.push(message),
    }).guard({ list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) });

    await guarded.list({ where: { label: 'a' } });
    await guarded.list({ where: { label: 'b' } });

    expect(said).toHaveLength(1);
  });

  it('stays quiet on a field the view hands back', async () => {
    const said: string[] = [];
    const list = vi.fn(async (_o?: ListOptions & Record<string, unknown>) => []);
    const guarded = new StorageGuard(Line.getFields(), 'line', {
      view: Line.getFields(),
      outOfView: (message) => said.push(message),
    }).guard({ list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) });

    await guarded.list({ where: { label: 'a' } });

    expect(said).toEqual([]);
  });
});

/**
 * The content of `where` passed in front of nobody.
 *
 * A write is judged field by field; a read was not — and `params.filter`, typed into a
 * browser, arrives here as it is through the admin door.
 */
describe('the criteria are judged the way a write is', () => {
  it('refuses a field the entity does not declare', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ where: { jardin: 1 } })).rejects.toThrow(/jardin/);
  });

  it('refuses a value the field would refuse on a write', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ where: { label: 'far too long' } })).rejects.toThrow(/label/);
  });

  it('judges a set member by member — that is what `IN` binds', async () => {
    const { storage, guarded } = guardedStorage();
    await guarded.list({ where: { label: ['a', 'b'] } });

    expect(storage.list).toHaveBeenCalledWith({ where: { label: ['a', 'b'] } });
  });

  it('refuses a misspelled comparison rather than dropping it', async () => {
    const { guarded } = guardedStorage();
    // Without this refusal, `gtee` filters nothing and the list answered is the whole table.
    await expect(guarded.list({ where: { label: { gtee: 'a' } } })).rejects.toThrow(/gtee/);
  });

  it('lets a known comparison through', async () => {
    const { storage, guarded } = guardedStorage();
    await guarded.list({ where: { label: { contains: 'a' } } });
    expect(storage.list).toHaveBeenCalledWith({ where: { label: { contains: 'a' } } });
  });

  it('refuses the set one member of which is refused', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ where: { label: ['a', 'far too long'] } })).rejects.toThrow(/label/);
  });
});
