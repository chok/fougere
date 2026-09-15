/** What a delete does to the rows that name it, when no foreign key does it instead. */
import { FieldSet, type SchemaView } from '@fougere/schema';
import type { Dependent } from './Dependent.js';
import type { Journal } from './Journal.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';

/** The gestures a release reaches a dependent's rows through. */
export interface Rows {
  findAllByKeys(field: string, keys: readonly string[]): Promise<Map<string, Record<string, unknown>[]>>;
  update(id: string, patch: Record<string, unknown>): Promise<unknown>;
  delete(id: string): Promise<boolean>;
}

/** What the guard hands a release: who depends on an entity, and how to reach their rows. */
export interface Releasing {
  dependentsOf(entity: string): readonly Dependent[];
  rowsOf(entity: string): Rows | undefined;
  schemaOf(entity: string): SchemaView | undefined;
  /** Written down while it happens, when a package provides one — absent is the plain walk. */
  journal(entity: string): Journal | undefined;
  /** Every declared remote — each one walks its own tree, and is alone able to. */
  peers(): readonly { release(entity: string, key: unknown, visited: readonly string[]): Promise<void> }[];
}

/**
 * The rows that name a key, taken out or emptied, deepest FIRST.
 *
 * Order is the whole guarantee: a child never outlives its parent, so an interruption leaves
 * fewer children and never an orphan. That is what lets a release cross a process without a
 * two-phase commit — and why nothing here needs to be undone, only finished.
 *
 * A row already visited is not visited again, which is what ends a cycle: `Category.parentId`
 * pointing at its own entity walks down and stops when a key repeats.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export async function release(
  entity: string,
  key: unknown,
  world: Releasing,
  visited: readonly string[] = [],
  row?: () => Promise<unknown>,
): Promise<void> {
  const mark = `${entity}#${String(key)}`;
  // Already on the trail means SOMEONE upstream is asking every process about this row, so
  // asking again would be the bounce two processes declaring each other would never end. The
  // local walk still runs: being asked is exactly the point, and only this process can do it.
  const asked = visited.includes(mark);
  const trail = asked ? visited : [...visited, mark];

  // Written down before the first hop, so a process that stops mid-way leaves a row saying so.
  // Absent, the hops are the same and nothing finishes them.
  const journal = world.journal(entity);
  if (journal && await journal.open(entity, String(key)) === 'busy') return;

  // Every declared remote, and every one of them: a frond behind `remotes:` may have no sources
  // here, so this process cannot see that its rows name ours — only that process can.
  if (!asked) for (const peer of world.peers()) await peer.release(entity, key, trail);

  try {
    await walk(entity, [key], world, new Set([mark]), trail);
  } catch (refusal) {
    // A refusal is an outcome, not an interruption: the framework decided, and redoing it
    // would only decide again — a run kept open for one would be swept forever. Anything
    // else stopped us mid-tree, and THAT is what a run is for.
    if (refusal instanceof FougereError) await journal?.close(entity, String(key));
    throw refusal;
  }

  // The row itself, LAST — handed in by whoever owns the gesture, so a run covers the whole
  // thing rather than stopping one statement short of it. Whatever the row answers, the
  // release did its part: what depends on this one is dealt with, and nothing is left to redo.
  try {
    await row?.();
  } finally {
    await journal?.close(entity, String(key));
  }
}

async function walk(
  entity: string,
  keys: readonly unknown[],
  world: Releasing,
  seen: Set<string>,
  trail: readonly string[],
): Promise<void> {
  const dependents = world.dependentsOf(entity);

  // Every refusal of this level BEFORE any of its rows move: two fields of one entity are two
  // dependents, and declaration order would otherwise let a cascade beside a `restrict` win.
  // Depth needs no such pass — a level acts only once the level below it came back.
  for (const dependent of dependents.filter((one) => one.onDelete === 'restrict')) {
    await refuseHeld(entity, dependent, keys, world);
  }

  for (const dependent of dependents.filter((one) => one.onDelete !== 'restrict')) {
    await carryOut(entity, dependent, keys, world, seen, trail);
  }
}

/** True once, and remembers — a key already on the path is what ends a cycle. */
function taken(seen: Set<string>, entity: string, key: unknown): boolean {
  const mark = `${entity}#${String(key)}`;
  if (seen.has(mark)) return true;
  seen.add(mark);

  return false;
}

function keyOf(world: Releasing, entity: string): string {
  const schema = world.schemaOf(entity);

  return (schema && FieldSet.of(schema.getFields()).primary) ?? 'id';
}

/** What names these rows and states `restrict` stops the whole release, before anything moves. */
async function refuseHeld(
  entity: string,
  dependent: Dependent,
  keys: readonly unknown[],
  world: Releasing,
): Promise<void> {
  const rows = world.rowsOf(dependent.entity);
  if (!rows) return;

  const found = [...(await rows.findAllByKeys(dependent.field, keys.map(String))).values()].flat();
  if (found.length === 0) return;

  throw new FougereError({
    code: ErrorCode.CONFLICT,
    message: `${dependent.entity}.${dependent.field} holds ${found.length} row(s) naming this one, `
      + `and states onDelete 'restrict' — take them out first, or declare what should happen.`,
    entity,
    operation: 'delete',
  });
}

/**
 * One dependent level: cleared here, or asked of whoever holds it.
 *
 * Nothing here holds those rows — every declared remote is asked about THIS level, and the one
 * that holds them walks its own tree from there. The trail grows by one mark per level, so a
 * deeper ask is never mistaken for the bounce of a shallower one.
 */
async function carryOut(
  entity: string,
  dependent: Dependent,
  keys: readonly unknown[],
  world: Releasing,
  seen: Set<string>,
  trail: readonly string[],
): Promise<void> {
  const rows = world.rowsOf(dependent.entity);
  if (!rows) {
    for (const key of keys) {
      // A level already on the trail is one somebody is asking every process about, so asking
      // again is the bounce — the same reason `release` reads it before crossing.
      if (trail.includes(`${entity}#${String(key)}`)) continue;
      for (const peer of world.peers()) await peer.release(entity, key, trail);
    }

    return;
  }

  const found = [...(await rows.findAllByKeys(dependent.field, keys.map(String))).values()].flat();
  if (found.length === 0) return;

  const primary = keyOf(world, dependent.entity);
  if (dependent.onDelete === 'set null') {
    for (const row of found) await rows.update(String(row[primary]), { [dependent.field]: null });

    return;
  }

  const below = found.map((row) => row[primary]).filter((id) => !taken(seen, dependent.entity, id));
  // Deepest first: what names THESE rows goes before they do, all the way down.
  await walk(dependent.entity, below, world, seen, trail);
  for (const id of below) await rows.delete(String(id));
}
