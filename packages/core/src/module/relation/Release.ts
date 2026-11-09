/** What a delete does to the rows that name it, when no foreign key does it instead. */
import { FieldSet, type SchemaView } from '@fougere/schema';
import type { Dependent } from './Dependent.js';
import type { Journal } from '../../wire/Journal.js';
import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';
import { ambient } from '../../slots.js';
import { markOf } from './FougereTarget.js';

/** The gestures a release reaches a dependent's rows through. */
export interface Rows {
  findAllByKeys(field: string, keys: readonly string[]): Promise<Map<string, Record<string, unknown>[]>>;
  update(id: string, patch: Record<string, unknown>): Promise<unknown>;
  delete(id: string): Promise<boolean>;
}

/** What a release asks across, of one process holding rows this one names. */
export interface ReleasePeer {
  /** Refuse as a release would, marking what it asked — answered with the marks it set. */
  refuses(entity: string, key: unknown, visited: readonly string[]): Promise<readonly string[]>;
  release(entity: string, key: unknown, visited: readonly string[]): Promise<void>;
  forget(marks: readonly string[]): Promise<void>;
}

/** What the guard hands a release: who depends on an entity, and how to reach their rows. */
export interface Releasing {
  dependentsOf(entity: string): readonly Dependent[];
  namersOf(entity: string): readonly Dependent[];
  rowsOf(entity: string): Rows | undefined;
  schemaOf(entity: string): SchemaView | undefined;
  journal(entity: string): Journal | undefined;
  peers(): readonly ReleasePeer[];
  /** Read `namer`'s rows naming these keys of `target`, marking those keys `gone` in the same unit of work where its source keeps marks. */
  marking<R>(namer: string, target: string, keys: readonly unknown[], marked: string[], read: (rows: Rows) => Promise<R>): Promise<R>;
  /** Take these marks out of every source of this process that keeps them. */
  forget(marks: readonly string[]): Promise<void>;
}

const released = ambient.slot<Set<string>>('released');

/**
 * The rows that name a key, every refusal asked first, then taken out or emptied deepest FIRST.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export async function release(
  entity: string,
  key: unknown,
  world: Releasing,
  visited: readonly string[] = [],
  row?: () => Promise<unknown>,
): Promise<void> {
  const mark = markOf(entity, key);
  const asked = visited.includes(mark);
  const trail = asked ? visited : [...visited, mark];

  const marks = !asked && !answeredByOneStatement(entity, world) ? await refuse(entity, key, world, visited) : [];

  const journal = asked ? undefined : world.journal(entity);
  if (journal && await journal.open(entity, String(key)) === 'busy') throw drivenElsewhere(entity, key);

  try {
    if (!asked) for (const peer of world.peers()) await peer.release(entity, key, trail);
    const seen = new Set([...(released.current() ?? []), ...trail]);
    await released.within(seen, () => walk(entity, [key], world, seen, trail));
  } catch (stopped) {
    if (decided(stopped)) {
      await forgetEverywhere(marks, world);
      await journal?.close(entity, String(key));
    } else await journal?.leave(entity, String(key));
    throw stopped;
  }

  try {
    await row?.();
  } catch (stopped) {
    await journal?.leave(entity, String(key));
    throw stopped;
  }

  await forgetEverywhere(marks, world);
  await journal?.close(entity, String(key));
}

/**
 * What would refuse this release, asked over the whole tree and every peer while nothing moves.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export async function refuse(
  entity: string,
  key: unknown,
  world: Releasing,
  visited: readonly string[] = [],
): Promise<string[]> {
  const mark = markOf(entity, key);
  const asked = visited.includes(mark);
  const trail = asked ? visited : [...visited, mark];
  const marked: string[] = [];

  try {
    if (!asked) for (const peer of world.peers()) marked.push(...await peer.refuses(entity, key, trail));
    await refuseBelow(entity, [key], world, new Set(trail), trail, marked);
  } catch (refusal) {
    await forgetEverywhere(marked, world);
    throw refusal;
  }

  return marked;
}

async function forgetEverywhere(marks: readonly string[], world: Releasing): Promise<void> {
  if (marks.length === 0) return;
  await world.forget(marks);
  for (const peer of world.peers()) await peer.forget(marks);
}

/** True when a release of this row is already under way in this async context, which deletes it itself. */
export function beingReleased(entity: string, key: unknown): boolean {
  return released.current()?.has(markOf(entity, key)) ?? false;
}

function answeredByOneStatement(entity: string, world: Releasing): boolean {
  return world.peers().length === 0 && world.dependentsOf(entity).length === 0;
}

function decided(stopped: unknown): boolean {
  return stopped instanceof FougereError && stopped.code === ErrorCode.CONFLICT;
}

function drivenElsewhere(entity: string, key: unknown): FougereError {
  return new FougereError({
    code: ErrorCode.LOCKED,
    message: `Another process is releasing ${entity} ${JSON.stringify(key)}. `
      + 'Retry once it finishes, or once its lease runs out.',
  });
}

async function refuseBelow(
  entity: string,
  keys: readonly unknown[],
  world: Releasing,
  seen: Set<string>,
  trail: readonly string[],
  marked: string[],
): Promise<void> {
  for (const dependent of world.namersOf(entity)) {
    if (!world.rowsOf(dependent.entity)) {
      for (const key of keys.filter((one) => !trail.includes(markOf(entity, one)))) {
        for (const peer of world.peers()) marked.push(...await peer.refuses(entity, key, trail));
      }
      continue;
    }

    const found = await world.marking(dependent.entity, entity, keys, marked, async (rows) => {
      if (dependent.onDelete === 'set null') return [];
      const naming = [...(await rows.findAllByKeys(dependent.field, keys.map(String))).values()].flat();
      if (dependent.onDelete === 'restrict' && naming.length > 0) throw restricted(dependent, naming.length);

      return naming;
    });
    if (dependent.onDelete !== 'cascade') continue;

    const primary = keyOf(world, dependent.entity);
    const below = found.map((one) => one[primary]).filter((id) => !taken(seen, dependent.entity, id));
    if (below.length > 0) await refuseBelow(dependent.entity, below, world, seen, trail, marked);
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

  for (const dependent of dependents.filter((one) => one.onDelete === 'restrict')) {
    await refuseRestricted(entity, dependent, keys, world);
  }

  for (const dependent of dependents.filter((one) => one.onDelete !== 'restrict')) {
    await releaseLevel(entity, dependent, keys, world, seen, trail);
  }
}

/** True once, and remembers — a key already on the path is what ends a cycle. */
function taken(seen: Set<string>, entity: string, key: unknown): boolean {
  const mark = markOf(entity, key);
  if (seen.has(mark)) return true;
  seen.add(mark);

  return false;
}

function keyOf(world: Releasing, entity: string): string {
  const schema = world.schemaOf(entity);

  return (schema && FieldSet.of(schema.getFields()).primary) ?? 'id';
}

/** What names these rows and states `restrict` stops the whole release, before anything moves. */
async function refuseRestricted(
  entity: string,
  dependent: Dependent,
  keys: readonly unknown[],
  world: Releasing,
): Promise<void> {
  const rows = world.rowsOf(dependent.entity);
  if (!rows) return;

  const found = [...(await rows.findAllByKeys(dependent.field, keys.map(String))).values()].flat();
  if (found.length > 0) throw restricted(dependent, found.length);
}

function restricted(dependent: Dependent, count: number): FougereError {
  return new FougereError({
    code: ErrorCode.CONFLICT,
    message: `${count} ${dependent.entity} row(s) still point to this one through ${dependent.field}. `
      + `Delete them first, or set onDelete on ${dependent.entity}.${dependent.field} ('cascade' or 'set null').`,
  });
}

/**
 * One dependent level: cleared here, or asked of whoever holds it.
 *
 * Nothing here holds those rows — every declared remote is asked about THIS level, and the one
 * that holds them walks its own tree from there.
 */
async function releaseLevel(
  entity: string,
  dependent: Dependent,
  keys: readonly unknown[],
  world: Releasing,
  seen: Set<string>,
  trail: readonly string[],
): Promise<void> {
  const rows = world.rowsOf(dependent.entity);
  if (!rows) {
    for (const key of keys.filter((one) => !trail.includes(markOf(entity, one)))) {
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
  await walk(dependent.entity, below, world, seen, trail);
  for (const id of below) await rows.delete(String(id));
}
