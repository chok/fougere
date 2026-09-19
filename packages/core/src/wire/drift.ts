import { Card, type Change, type SchemaDescriptor } from '@fougere/schema';
import type { IdentityCard } from './card/IdentityCard.js';

/** What separates the copy a consumer holds from what the producer actually serves. */
export interface CardDrift {
  frond: string;
  /** A facade the consumer calls that the producer no longer serves. */
  missingDoors: string[];
  /** An operation the consumer calls that the facade no longer has. */
  missingOps: { facade: string; ops: string[] }[];
  /** A shape that moved under a facade the consumer still calls. */
  shapes: { facade: string; changes: Change[] }[];
  /** A fact the consumer subscribes to whose shape moved, or that is gone. */
  facts: { fact: string; changes: Change[] | 'gone' }[];
}

/** Every facade of a card, by name. */
/** What a door of that card answers, and the shape of the row it hands back. */
interface Answering {
  ops: Set<string>;
  schema?: SchemaDescriptor;
}

function facadesOf(card: IdentityCard, frond: string): Map<string, Answering> {
  const found = new Map<string, Answering>();
  for (const one of card.fronds) {
    if (one.name !== frond) continue;
    for (const facade of one.facades) {
      found.set(facade.name, { ops: new Set(facade.ops.map((op) => op.name)), schema: facade.schema });
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

/** What a consumer's synced copy no longer matches in what the producer serves. */
export function driftOf(mine: IdentityCard, theirs: IdentityCard, frond: string): CardDrift {
  const drift: CardDrift = { frond, missingDoors: [], missingOps: [], shapes: [], facts: [] };

  driftInDoors(facadesOf(mine, frond), facadesOf(theirs, frond), drift);
  driftInFacts(factsOf(mine, frond), factsOf(theirs, frond), drift);

  return drift;
}

/** A door that is gone, an operation it no longer answers, or a row that changed shape. */
function driftInDoors(
  mine: Map<string, Answering>,
  theirs: Map<string, Answering>,
  drift: CardDrift,
): void {
  for (const [name, facade] of mine) {
    const there = theirs.get(name);
    if (!there) {
      drift.missingDoors.push(name);
      continue;
    }

    const missing = [...facade.ops].filter((op) => !there.ops.has(op));
    if (missing.length > 0) drift.missingOps.push({ facade: name, ops: missing.sort() });

    if (!facade.schema || !there.schema) continue;

    // `Card.diff` never guesses a rename — a field gone plus a field appeared lands in
    // `ambiguous`, and only a declaration settles it. Here nobody can declare one, so the
    // pair is reported as it is and a human reads it.
    const moved = Card.fromDescriptor(facade.schema).diff(Card.fromDescriptor(there.schema));
    if (moved.changes.length > 0) drift.shapes.push({ facade: name, changes: moved.changes });
  }
}

/** A fact nobody announces any more, or one whose payload moved under its readers. */
function driftInFacts(
  mine: Map<string, SchemaDescriptor | undefined>,
  theirs: Map<string, SchemaDescriptor | undefined>,
  drift: CardDrift,
): void {
  for (const [name, shape] of mine) {
    if (!theirs.has(name)) {
      drift.facts.push({ fact: name, changes: 'gone' });
      continue;
    }

    const there = theirs.get(name);
    if (!shape || !there) continue;

    const moved = Card.fromDescriptor(shape).diff(Card.fromDescriptor(there));
    if (moved.changes.length > 0) drift.facts.push({ fact: name, changes: moved.changes });
  }
}

/** Whether anything at all separates the two cards. */
export function agrees(drift: CardDrift): boolean {
  return drift.missingDoors.length === 0
    && drift.missingOps.length === 0
    && drift.shapes.length === 0
    && drift.facts.length === 0;
}

/** The drift, in the words a deploy needs. */
export function explain(drift: CardDrift): string[] {
  const lines: string[] = [];
  for (const facade of drift.missingDoors) lines.push(`${drift.frond}.${facade} — you call it, it is not served`);
  for (const { facade, ops } of drift.missingOps) lines.push(`${drift.frond}.${facade} — gone: ${ops.join(', ')}`);
  for (const { facade, changes } of drift.shapes) {
    for (const change of changes) lines.push(`${drift.frond}.${facade} — ${describe(change)}`);
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
    case 'restated': return `${change.field}: its ${change.axis} moved`;
  }
}
