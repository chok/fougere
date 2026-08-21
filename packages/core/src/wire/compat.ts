/**
 * Does what a host serves still honour what a consumer accepted?
 *
 * `diff` answers that of one SHAPE. A card is doors, operations and facts as well, and a
 * consumer breaks on any of them — so the comparison is stated here, over the whole card,
 * and delegates every field-level question to the one calculation that already exists.
 *
 * The asymmetry is the point: a card is compared FROM the consumer's side. What the host
 * gained is reported and never blocks, what the consumer counted on and no longer has is a
 * breach. That is the same rule an additive migration obeys, read across a wire.
 */
import { diff, type Change } from '@fougere/schema';
import type { CardOp, IdentityCard } from './call.js';

/** One frond, as a card carries it. */
export type CardFrond = IdentityCard['fronds'][number];

/** Something the consumer accepted and the host no longer honours. */
export type Breach =
  | { kind: 'frond-gone'; frond: string }
  | { kind: 'door-gone'; frond: string; door: string }
  /** The door answers, but the rows behind it are no longer described. */
  | { kind: 'shape-gone'; frond: string; door: string }
  | { kind: 'op-gone'; frond: string; door: string; op: string }
  /** Same name, different promise — a query became a command, or a row became a page. */
  | { kind: 'op-changed'; frond: string; door: string; op: string; was: string; now: string }
  | { kind: 'field'; frond: string; door: string; change: Change }
  | { kind: 'fact-gone'; frond: string; fact: string }
  | { kind: 'fact-field'; frond: string; fact: string; change: Change };

/** Something the host gained. Reported so a consumer knows a re-sync is worth it. */
export type Addition =
  | { kind: 'door-added'; frond: string; door: string }
  | { kind: 'op-added'; frond: string; door: string; op: string }
  | { kind: 'field-added'; frond: string; door: string; field: string }
  | { kind: 'fact-added'; frond: string; fact: string };

export interface Compatibility {
  breaking: Breach[];
  additive: Addition[];
  /**
   * Removals that could be renames — `diff`'s own word for what it refuses to decide.
   * Never a verdict: the matching breach is already in `breaking`, this only says a
   * re-sync may be all it takes.
   */
  ambiguous: Array<{ door: string; removed: string; added: string }>;
}

/**
 * The one change a consumer absorbs: a field it never asked for and need not send.
 *
 * Everything else is a breach, `reshaped` included — `diff` reports that bounds moved
 * without saying which way, and a card is read by writers as well as readers. Widening
 * therefore shows up as a breach a re-sync clears, which is the cheap side of the mistake.
 */
function absorbed(change: Change): change is Change & { kind: 'added' } {
  return change.kind === 'added' && !change.required;
}

/** How much an operation promises — its own two answers, as one comparable word. */
function promiseOf(op: CardOp): string {
  return `${op.kind}/${op.cardinality ?? 'unspecified'}`;
}

/** A fact whose announced type is not a declared entity carries no shape — legal, and empty. */
const EMPTY_SHAPE = {
  type: 'object' as const,
  properties: {},
  'x-fougere-version': 1 as const,
  'x-fougere-vendor': 'fougere' as const,
};

/**
 * What `served` fails to honour of `accepted`.
 *
 * `served` is `undefined` when the host does not carry the frond at all — one breach, not
 * one per door: a consumer reading it needs the cause, not its consequences.
 */
export function compare(accepted: CardFrond, served: CardFrond | undefined): Compatibility {
  const breaking: Breach[] = [];
  const additive: Addition[] = [];
  const ambiguous: Compatibility['ambiguous'] = [];
  const frond = accepted.name;

  if (served === undefined) return { breaking: [{ kind: 'frond-gone', frond }], additive, ambiguous };

  const servedDoors = new Map(served.doors.map((d) => [d.name, d]));
  for (const door of accepted.doors) {
    const now = servedDoors.get(door.name);
    if (now === undefined) {
      breaking.push({ kind: 'door-gone', frond, door: door.name });
      continue;
    }

    if (door.schema !== undefined && now.schema === undefined) {
      breaking.push({ kind: 'shape-gone', frond, door: door.name });
    } else if (door.schema !== undefined && now.schema !== undefined) {
      const answer = diff(door.schema, now.schema);
      for (const change of answer.changes) {
        if (absorbed(change)) additive.push({ kind: 'field-added', frond, door: door.name, field: change.field });
        else breaking.push({ kind: 'field', frond, door: door.name, change });
      }
      for (const pair of answer.ambiguous) ambiguous.push({ door: door.name, ...pair });
    }

    const servedOps = new Map(now.ops.map((o) => [o.name, o]));
    for (const op of door.ops) {
      const target = servedOps.get(op.name);
      if (target === undefined) {
        breaking.push({ kind: 'op-gone', frond, door: door.name, op: op.name });
        continue;
      }
      const was = promiseOf(op);
      const promise = promiseOf(target);
      if (was !== promise) {
        breaking.push({ kind: 'op-changed', frond, door: door.name, op: op.name, was, now: promise });
      }
    }
    for (const op of now.ops) {
      if (!door.ops.some((o) => o.name === op.name)) {
        additive.push({ kind: 'op-added', frond, door: door.name, op: op.name });
      }
    }
  }
  for (const door of served.doors) {
    if (!accepted.doors.some((d) => d.name === door.name)) {
      additive.push({ kind: 'door-added', frond, door: door.name });
    }
  }

  // A fact is judged strictly on arrival, so a shape that moved is a refusal at the
  // subscriber — the same breach as a field on a door, under the name it arrives by.
  const servedFacts = new Map(served.facts.map((f) => [f.name, f]));
  for (const fact of accepted.facts) {
    const now = servedFacts.get(fact.name);
    if (now === undefined) {
      breaking.push({ kind: 'fact-gone', frond, fact: fact.name });
      continue;
    }
    const before = fact.schema ?? EMPTY_SHAPE;
    const after = now.schema ?? EMPTY_SHAPE;
    for (const change of diff(before, after).changes) {
      if (!absorbed(change)) breaking.push({ kind: 'fact-field', frond, fact: fact.name, change });
    }
  }
  for (const fact of served.facts) {
    if (!accepted.facts.some((f) => f.name === fact.name)) {
      additive.push({ kind: 'fact-added', frond, fact: fact.name });
    }
  }

  return { breaking, additive, ambiguous };
}

/** One breach, said the way a person reads it. */
export function breachMessage(breach: Breach): string {
  switch (breach.kind) {
    case 'frond-gone':
      return `frond '${breach.frond}' is not served here`;
    case 'door-gone':
      return `${breach.door} is gone`;
    case 'shape-gone':
      return `${breach.door} no longer describes its rows`;
    case 'op-gone':
      return `${breach.door}.${breach.op}() is gone`;
    case 'op-changed':
      return `${breach.door}.${breach.op}() now answers ${breach.now}, accepted as ${breach.was}`;
    case 'fact-gone':
      return `fact ${breach.fact} is no longer announced`;
    case 'field':
      return `${breach.door}: ${changeMessage(breach.change)}`;
    case 'fact-field':
      return `fact ${breach.fact}: ${changeMessage(breach.change)}`;
  }
}

function changeMessage(change: Change): string {
  switch (change.kind) {
    case 'removed':
      return `${change.field} is gone`;
    case 'renamed':
      return `${change.from} is now ${change.to}`;
    case 'retyped':
      return `${change.field} is ${change.to.join(' | ')}, accepted as ${change.from.join(' | ')}`;
    case 'reshaped':
      return `${change.field} has different bounds`;
    case 'required':
      return change.to ? `${change.field} is now required` : `${change.field} is no longer required`;
    case 'added':
      return `${change.field} was added and is required`;
  }
}
