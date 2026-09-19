import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Card, type Change, type SchemaDescriptor, type SchemaView } from '@fougere/schema';
import type { IdentityCard } from '@fougere/core';
import type { SyncedRemote } from './SyncedRemote.js';

/** What separates a consumer's synced copy from what the producer serves today. */
export interface SyncDrift {
  frond: string;
  /** An entity the consumer holds that the producer no longer serves. */
  gone: string[];
  /** A shape that moved under a name the consumer still holds. */
  moved: { entity: string; changes: Change[] }[];
}

/** The shapes a consumer holds for one remote frond. */
export async function heldShapes(remote: SyncedRemote): Promise<Map<string, SchemaDescriptor>> {
  const cards = new Map<string, SchemaDescriptor>();
  const index = pathToFileURL(join(remote.path, 'index.ts')).href;
  const module = await import(index) as Record<string, unknown>;

  for (const [name, exported] of Object.entries(module)) {
    const entity = exported as SchemaView | undefined;
    if (typeof entity !== 'function' || typeof (entity as SchemaView).getFields !== 'function') continue;
    cards.set(name, Card.fromSchema(entity).descriptor);
  }

  return cards;
}

/** The shapes a card announces, by the name a facade carries. */
function servedShapes(card: IdentityCard, frond: string): Map<string, unknown> {
  const served = new Map<string, unknown>();
  for (const one of card.fronds) {
    if (one.name !== frond) continue;
    for (const facade of one.facades) if (facade.schema) served.set(facade.schema.title ?? facade.name, facade.schema);
  }

  return served;
}

/** What the consumer's copy no longer matches. */
export function syncDriftOf(
  held: Map<string, SchemaDescriptor>,
  card: IdentityCard,
  frond: string,
): SyncDrift {
  const served = servedShapes(card, frond);
  const drift: SyncDrift = { frond, gone: [], moved: [] };

  for (const [name, mine] of held) {
    const theirs = served.get(name) ?? served.get(name.toLowerCase());
    if (!theirs) { drift.gone.push(name); continue; }
    const moved = Card.fromDescriptor(mine).diff(Card.fromDescriptor(theirs as SchemaDescriptor));
    if (moved.changes.length > 0) drift.moved.push({ entity: name, changes: moved.changes });
  }

  return drift;
}

/** Whether the copy still matches. */
export function inSync(drift: SyncDrift): boolean {
  return drift.gone.length === 0 && drift.moved.length === 0;
}
