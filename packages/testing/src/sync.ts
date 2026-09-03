import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Card, type Change, type SchemaDescriptor, type SchemaView } from '@fougere/schema';
import type { IdentityCard } from '@fougere/core';

/** One entry of `.fougere/remotes.json`, written by `fougere sync`. */
export interface SyncedRemote {
  name: string;
  url: string;
  /** Where the synced classes were written. */
  path: string;
}

/** What separates a consumer's synced copy from what the producer serves today. */
export interface SyncDrift {
  frond: string;
  /** An entity the consumer holds that the producer no longer serves. */
  gone: string[];
  /** A shape that moved under a name the consumer still holds. */
  moved: { entity: string; changes: Change[] }[];
}

/** The remotes a project synced, read from the file `fougere sync` writes. */
export async function syncedRemotes(root: string): Promise<SyncedRemote[]> {
  try {
    const raw = await readFile(join(root, '.fougere', 'remotes.json'), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, { url: string; path: string }>;
    return Object.entries(parsed).map(([name, one]) => ({ name, ...one }));
  } catch {
    // No file is the ordinary case: an app with no remote synced nothing.
    return [];
  }
}

/**
 * The shapes a consumer holds for one remote frond.
 *
 * Rebuilt from the classes rather than read back: `fougere sync` writes entities and an
 * index and does NOT keep the card it received. So the consumer's copy of the OPERATIONS
 * has no local counterpart at all, and only the shapes can be compared — which is the
 * narrower half, and the one that breaks a caller silently.
 *
 * Closing that would mean `sync` writing the card beside the classes; it is a change to
 * the CLI, not to this file.
 */
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

/** The shapes a card announces, by the name a door carries. */
function servedShapes(card: IdentityCard, frond: string): Map<string, unknown> {
  const served = new Map<string, unknown>();
  for (const one of card.fronds) {
    if (one.name !== frond) continue;
    for (const door of one.doors) if (door.schema) served.set(door.schema.title ?? door.name, door.schema);
  }
  return served;
}

/**
 * What the consumer's copy no longer matches.
 *
 * Compared by the shape's own `title` — the entity's name as the descriptor carries it —
 * rather than by the door's, because a door is addressed in lowercase (`post`) and a class
 * is not (`Post`), and matching those two by hand is where a name convention gets copied
 * a third time.
 */
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
