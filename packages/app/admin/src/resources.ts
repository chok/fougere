/**
 * What the app hosts, read as a back-office.
 *
 * The card (`rpc.discover`) already answers every question a back-office asks: which
 * doors exist, what each one stores, and which of the five verbs it serves. So there
 * is nothing to generate and nothing to configure — a new entity appears in the menu
 * because the card grew a door, not because a file was written.
 *
 * Two projections of the same shape, and they are the pair `form.ts` already draws:
 * `tableColumnsOf` for what a list SHOWS, `formFieldsOf` for what a form SUPPLIES.
 */
import { Card, FieldSet, type SchemaView } from '@fougere/schema';
import {
  CALL_ENDPOINT,
  fetcher as browserFetcher,
  formFieldsOf,
  sendCall,
  tableColumnsOf,
  type Fetcher,
  type FormField,
  type TableColumn,
} from '@fougere/app/client';
import { EMPTY_INVOCATION, type CardOp, type IdentityCard } from '@fougere/core/contract';
import type { ResourceKey } from './provider.js';
import type { AdminFacets } from './facets.js';

/** One operation as the admin meets it, before a renderer decides its widget. */
export interface AdminOperation extends CardOp {
  /** Display fallback. An extension may replace it without renaming the call. */
  label: string;
  /** Optional confirmation sentence, interpreted by renderers that support actions. */
  confirm?: string;
}

/** One door, everything the UI needs to render it. */
export interface AdminResource extends ResourceKey {
  /** The frond it belongs to — the menu groups by it, as the card does. */
  frond: string;
  /** Display fallback. The registration key in `name` never changes. */
  label: string;
  /**
   * Declared semantic notions, empty until an extension states one. Nothing is
   * inferred: what a closed set's member MEANS is not in its shape.
   */
  facets: AdminFacets;
  /** What a row shows in a list, and what a reference points at. */
  columns: TableColumn[];
  /** What a create/edit form is made of, with its browser-enforced bounds. */
  fields: FormField[];
  /** Every callable operation, including the five CRUD verbs. */
  operations: AdminOperation[];
  /**
   * Which of the five the door actually serves. A door answering only `list` gets a
   * list and no buttons — the card says so, so the UI never offers what would 404.
   */
  can: { list: boolean; show: boolean; create: boolean; edit: boolean; delete: boolean };
}

function labelOf(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The five verbs react-admin already has pages for. Everything else a door serves is a
 * business operation, and gets a button rather than a page.
 */
export const CRUD_OPS = ['list', 'findById', 'create', 'update', 'delete'] as const;

/** What a door serves beyond CRUD — the only thing this panel has that a generic one has not. */
export function actionsOf(operations: readonly AdminOperation[]): AdminOperation[] {
  return operations.filter((op) => !(CRUD_OPS as readonly string[]).includes(op.name));
}

/** Capabilities are a reading of the visible operations, never a second list to maintain. */
export function capabilitiesOf(operations: ReadonlyArray<Pick<AdminOperation, 'name'>>): AdminResource['can'] {
  const serves = new Set(operations.map((op) => op.name));
  return {
    list: serves.has('list'),
    show: serves.has('findById'),
    create: serves.has('create'),
    edit: serves.has('update'),
    delete: serves.has('delete'),
  };
}

/**
 * A door with no schema is not a resource.
 *
 * The card omits `schema` when nothing is stored under that name, and that is
 * ordinary — a health check, a search across several shapes. There is no table to
 * draw for it, and no form. It stays reachable by hand; it is simply not furniture.
 */
export function resourcesOf(card: IdentityCard): AdminResource[] {
  const out: AdminResource[] = [];
  for (const frond of card.fronds) {
    for (const door of frond.doors) {
      if (!door.schema) continue;
      const entity = Card.fromDescriptor(door.schema).toSchema() as unknown as SchemaView;
      const primary = FieldSet.of(entity.getFields()).primary;
      // No primary means no row identity — a list could be drawn, but nothing could be
      // opened, edited or deleted. Refusing here is the same answer `FieldSet.primary`
      // gives by not defaulting to 'id': the caller decides, and this caller declines.
      if (!primary) continue;
      const operations = door.ops.map((op) => ({ ...op, label: labelOf(op.name) }));
      const columns = tableColumnsOf(entity, door.name);
      const fields = formFieldsOf(entity, door.name);
      out.push({
        name: door.name,
        frond: frond.name,
        label: labelOf(door.name),
        facets: {},
        primary,
        columns,
        fields,
        operations,
        can: capabilitiesOf(operations),
      });
    }
  }
  return out;
}

/** The provider's index — the half of a resource it needs, keyed by door name. */
export function keysOf(resources: AdminResource[]): Record<string, ResourceKey> {
  return Object.fromEntries(resources.map((r) => [r.name, { name: r.name, primary: r.primary }]));
}

/**
 * Ask the running app what it hosts.
 *
 * `rpc.discover` travels on the same wire as every other call — it is a reserved op,
 * not a second endpoint — so a back-office needs no configuration to find its
 * subject, and gets the same answer whether the frond is in this process or behind
 * an address in `remotes:`.
 */
export async function fetchCard(
  endpoint = CALL_ENDPOINT,
  fetcher: Fetcher = browserFetcher,
): Promise<IdentityCard> {
  return await sendCall(
    fetcher,
    { entity: 'rpc', op: 'discover' },
    EMPTY_INVOCATION,
    endpoint,
  ) as IdentityCard;
}
