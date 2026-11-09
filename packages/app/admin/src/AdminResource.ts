import { Card, FieldSet, lowerFirst, type Entity, type SchemaView } from '@fougere/schema';
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
import { type IdentityCard, Invocation } from '@fougere/core/contract';
import type { ResourceKey } from './ResourceKey.js';
import type { AdminFacets } from './AdminFacets.js';
import type { AdminOperation } from './AdminOperation.js';

/** One facade, everything the UI needs to render it. */
export interface AdminResource extends ResourceKey {
  /** The frond it belongs to — the menu groups by it, as the card does. */
  frond: string;
  /** Display fallback. The registration key in `name` never changes. */
  label: string;
  /** What an extension declares a value means; empty until one does. */
  facets: AdminFacets;
  /** What a row shows in a list, and what a reference points at. */
  columns: TableColumn[];
  /** What a create/edit form is made of, with its browser-enforced bounds. */
  fields: FormField[];
  /** Every callable operation, including the five CRUD verbs. */
  operations: AdminOperation[];
  /** Which of the five the facade serves, so the UI offers nothing that would 404. */
  can: { list: boolean; show: boolean; create: boolean; edit: boolean; delete: boolean };
}

function labelOf(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The five verbs react-admin has pages for; any other operation gets a button. */
export const CRUD_OPS = ['list', 'findById', 'create', 'update', 'delete'] as const;

/** What a facade serves beyond CRUD — the only thing this panel has that a generic one has not. */
export function actionsOf(operations: readonly AdminOperation[]): AdminOperation[] {
  return operations.filter((op) => !(CRUD_OPS as readonly string[]).includes(op.name));
}

/** Capabilities are a reading of the visible operations, never a second list to maintain. */
export function capabilitiesOf(operations: readonly Pick<AdminOperation, 'name'>[]): AdminResource['can'] {
  const serves = new Set(operations.map((op) => op.name));

  return {
    list: serves.has('list'),
    show: serves.has('findById'),
    create: serves.has('create'),
    edit: serves.has('update'),
    delete: serves.has('delete'),
  };
}

function rowsOf(facade: IdentityCard['fronds'][number]['facades'][number]): string | undefined {
  const reads = facade.ops.find((op) => op.name === 'list') ?? facade.ops.find((op) => op.name === 'findById');

  return reads?.output?.title;
}

/** A facade that answers no entity's rows is not a resource. */
export function resourcesOf(card: IdentityCard): AdminResource[] {
  const out: AdminResource[] = [];
  const schemas = new Map<string, Entity>();
  const resolve = (name: string) => schemas.get(lowerFirst(name));
  for (const frond of card.fronds) {
    for (const stored of frond.entities) {
      schemas.set(stored.name, Card.fromDescriptor(stored.schema).toSchema(resolve));
    }
  }
  for (const frond of card.fronds) {
    for (const facade of frond.facades) {
      const rows = rowsOf(facade);
      const entity = rows === undefined ? undefined : schemas.get(rows);
      if (!entity) continue;
      const primary = FieldSet.of(entity.getFields()).primary;
      if (!primary) continue;
      const operations = facade.ops.map((op) => ({ ...op, label: labelOf(op.name) }));
      const columns = tableColumnsOf(entity, facade.name);
      const fields = formFieldsOf(entity, facade.name);
      out.push({
        name: facade.name,
        frond: frond.name,
        label: labelOf(facade.name),
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

/** The provider's index — the half of a resource it needs, keyed by facade name. */
export function keysOf(resources: AdminResource[]): Record<string, ResourceKey> {
  return Object.fromEntries(resources.map((r) => [r.name, { name: r.name, primary: r.primary }]));
}

/** Ask the running app what it hosts. */
export async function fetchCard(
  endpoint = CALL_ENDPOINT,
  fetcher: Fetcher = browserFetcher,
): Promise<IdentityCard> {
  return await sendCall(
    fetcher,
    { address: 'rpc', op: 'discover' },
    Invocation.empty,
    endpoint,
  ) as IdentityCard;
}
