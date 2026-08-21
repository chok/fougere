import { diff, type Change, type SchemaDescriptor } from '@fougere/schema';
import type { IdentityCard } from '@fougere/core';

/** What separates the copy a consumer holds from what the producer actually serves. */
export interface CardDrift {
  frond: string;
  /** A door the consumer calls that the producer no longer serves. */
  missingDoors: string[];
  /** An operation the consumer calls that the door no longer has. */
  missingOps: { door: string; ops: string[] }[];
  /** A shape that moved under a door the consumer still calls. */
  shapes: { door: string; changes: Change[] }[];
  /** A fact the consumer subscribes to whose shape moved, or that is gone. */
  facts: { fact: string; changes: Change[] | 'gone' }[];
}

/** Every door of a card, by name. */
function doorsOf(card: IdentityCard, frond: string): Map<string, { ops: Set<string>; schema?: SchemaDescriptor }> {
  const found = new Map<string, { ops: Set<string>; schema?: SchemaDescriptor }>();
  for (const one of card.fronds) {
    if (one.name !== frond) continue;
    for (const door of one.doors) {
      found.set(door.name, { ops: new Set(door.ops.map((op) => op.name)), schema: door.schema });
    }
  }
  return found;
}

function factsOf(card: IdentityCard, frond: string): Map<string, SchemaDescriptor | undefined> {
  const found = new Map<string, SchemaDescriptor | undefined>();
  for (const one of card.fronds) {
    if (one.name !== frond) continue;
    for (const fact of one.facts ?? []) found.set(fact.name, fact.schema as SchemaDescriptor | undefined);
  }
  return found;
}

/**
 * What a consumer's synced copy no longer matches in what the producer serves.
 *
 * The gap TypeScript cannot see, and the only place the gradient genuinely lies: the code
 * is identical in-process and split, but one side may have aged. `fougere sync` wrote the
 * consumer's copy three weeks ago, the producer moved on, and it still compiles —
 * production is where that is found today. This is what Pact sells; the material was
 * already here, in `rpc.discover` and in `diff`.
 *
 * Read in ONE direction on purpose: what the consumer holds, checked against what is
 * served. A producer serving MORE than the consumer knows is not drift — it is a producer
 * that moved forward without breaking anyone, which is the whole point of the order the
 * repo already states (re-sync the readers, then deploy the sender).
 */
export function driftOf(mine: IdentityCard, theirs: IdentityCard, frond: string): CardDrift {
  const held = doorsOf(mine, frond);
  const served = doorsOf(theirs, frond);
  const drift: CardDrift = { frond, missingDoors: [], missingOps: [], shapes: [], facts: [] };

  for (const [name, door] of held) {
    const there = served.get(name);
    if (!there) { drift.missingDoors.push(name); continue; }

    const missing = [...door.ops].filter((op) => !there.ops.has(op));
    if (missing.length > 0) drift.missingOps.push({ door: name, ops: missing.sort() });

    if (door.schema && there.schema) {
      // `diff` never guesses a rename — a field gone plus a field appeared lands in
      // `ambiguous`, and only a declaration settles it. Here nobody can declare one, so
      // the pair is reported as it is and a human reads it.
      const moved = diff(door.schema, there.schema);
      if (moved.changes.length > 0) drift.shapes.push({ door: name, changes: moved.changes });
    }
  }

  const heldFacts = factsOf(mine, frond);
  const servedFacts = factsOf(theirs, frond);
  for (const [name, shape] of heldFacts) {
    if (!servedFacts.has(name)) { drift.facts.push({ fact: name, changes: 'gone' }); continue; }
    const there = servedFacts.get(name);
    if (!shape || !there) continue;
    const moved = diff(shape, there);
    if (moved.changes.length > 0) drift.facts.push({ fact: name, changes: moved.changes });
  }

  return drift;
}

/** Whether anything at all separates the two cards. */
export function agrees(drift: CardDrift): boolean {
  return drift.missingDoors.length === 0
    && drift.missingOps.length === 0
    && drift.shapes.length === 0
    && drift.facts.length === 0;
}

/**
 * The drift, in the words a deploy needs.
 *
 * A fact says the order out loud, because the repo already states it as a rule and
 * nothing enforced it: a fact is judged strictly, so a reader that has not been re-synced
 * refuses what the sender now announces.
 */
export function explain(drift: CardDrift): string[] {
  const lines: string[] = [];
  for (const door of drift.missingDoors) lines.push(`${drift.frond}.${door} — you call it, it is not served`);
  for (const { door, ops } of drift.missingOps) lines.push(`${drift.frond}.${door} — gone: ${ops.join(', ')}`);
  for (const { door, changes } of drift.shapes) {
    for (const change of changes) lines.push(`${drift.frond}.${door} — ${describe(change)}`);
  }
  for (const { fact, changes } of drift.facts) {
    if (changes === 'gone') { lines.push(`${fact} — you subscribe to it, it is no longer announced`); continue; }
    for (const change of changes) lines.push(`${fact} — ${describe(change)} → re-sync and deploy the readers, THEN the sender`);
  }
  return lines;
}

function describe(change: Change): string {
  switch (change.kind) {
    case 'added': return `+ ${change.field}${change.required ? ' (required)' : ''}`;
    case 'removed': return `- ${change.field}`;
    case 'renamed': return `${change.from} → ${change.to}`;
    case 'retyped': return `${change.field}: ${[...change.from].join('|')} → ${[...change.to].join('|')}`;
    case 'reshaped': return `${change.field}: its bounds moved`;
    case 'required': return `${change.field}: ${change.from ? 'no longer' : 'now'} required`;
  }
}
