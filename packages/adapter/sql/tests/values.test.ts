/**
 * A round trip through a real driver, on the four shapes that used to throw.
 *
 * Before this, `done: bool()` threw at insert and a `date()` could only be written as
 * the ISO string its own type forbids. The test writes what the entity declares and
 * expects to read back the same kinds — not the column's.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, bool, date, list, json, optional } from '@fougere/schema';
import { autoMigrate } from '../src/index.js';
import { setupSqlite } from '../src/sqlite.js';
import { codecFor } from '../src/values.js';

class Task extends entity({
  id: primary(),
  title: text(),
  done: bool(),
  dueAt: optional(date()),
  tags: list(text()),
  payload: json(),
}) {}

describe('the values a driver can bind', () => {
  let storage: any;

  beforeEach(async () => {
    const setup = setupSqlite({ path: ':memory:' });
    await autoMigrate({ fronds: [{ name: 'app', entities: [{ name: 'task', entityClass: Task }] }] }, setup.sqlite);
    storage = setup.storageFactory(Task, 'task');
  });

  it('writes a boolean and reads a boolean', async () => {
    const created = await storage.create({ id: 't1', title: 'x', done: true, tags: [], payload: {} });
    expect(created.done).toBe(true);

    const read = await storage.findById('t1');
    expect(read!.done).toBe(true);
  });

  it('keeps false false — the value a truthiness bug would lose', async () => {
    await storage.create({ id: 't2', title: 'x', done: false, tags: [], payload: {} });
    expect((await storage.findById('t2'))!.done).toBe(false);
  });

  it('writes a Date and reads a Date', async () => {
    const dueAt = new Date('2026-07-28T10:00:00.000Z');
    await storage.create({ id: 't3', title: 'x', done: false, dueAt, tags: [], payload: {} });

    const read = await storage.findById('t3');
    expect(read!.dueAt).toBeInstanceOf(Date);
    expect((read!.dueAt as Date).toISOString()).toBe(dueAt.toISOString());
  });

  it('still accepts the ISO string the old casts passed', async () => {
    await storage.create({ id: 't4', title: 'x', done: false, dueAt: '2026-07-28T10:00:00.000Z' as never, tags: [], payload: {} });
    expect((await storage.findById('t4'))!.dueAt).toBeInstanceOf(Date);
  });

  it('writes a list and an object, reads them back', async () => {
    await storage.create({ id: 't5', title: 'x', done: false, tags: ['a', 'b'], payload: { n: 1, deep: { ok: true } } });

    const read = await storage.findById('t5');
    expect(read!.tags).toEqual(['a', 'b']);
    expect(read!.payload).toEqual({ n: 1, deep: { ok: true } });
  });

  it('leaves an absent optional alone instead of inventing one', async () => {
    await storage.create({ id: 't6', title: 'x', done: false, tags: [], payload: {} });
    expect((await storage.findById('t6'))!.dueAt).toBeNull();
  });

  it('filters on the column value, not the entity value', async () => {
    await storage.create({ id: 't7', title: 'yes', done: true, tags: [], payload: {} });
    await storage.create({ id: 't8', title: 'no', done: false, tags: [], payload: {} });

    const found = await storage.findBy({ done: true });
    expect(found!.id).toBe('t7');
  });

  it('updates through the same conversion', async () => {
    await storage.create({ id: 't9', title: 'x', done: false, tags: [], payload: {} });
    const updated = await storage.update('t9', { done: true, tags: ['z'] });

    expect(updated.done).toBe(true);
    expect(updated.tags).toEqual(['z']);
  });
});

describe('which shapes get a conversion', () => {
  it('leaves text and numbers untouched — the driver already takes them', () => {
    const plain = codecFor({ type: 'string' });
    expect(plain.write('x')).toBe('x');
    expect(codecFor({ type: 'number' }).write(3.5)).toBe(3.5);
    expect(codecFor(undefined).write('x')).toBe('x');
  });

  it('never invents a value out of null or undefined', () => {
    for (const shape of [{ type: 'boolean' }, { type: 'string', format: 'date-time' }, { type: 'array' }] as const) {
      const codec = codecFor(shape);
      expect(codec.write(null)).toBeNull();
      expect(codec.write(undefined)).toBeUndefined();
      expect(codec.read(null)).toBeNull();
    }
  });

  it('leaves a value a richer driver already converted', () => {
    // Postgres hands back a real boolean and a real Date; nothing to redo.
    expect(codecFor({ type: 'boolean' }).read(true)).toBe(true);
    const now = new Date();
    expect(codecFor({ type: 'string', format: 'date-time' }).read(now)).toBe(now);
    expect(codecFor({ type: 'object' }).read({ a: 1 })).toEqual({ a: 1 });
  });
});
