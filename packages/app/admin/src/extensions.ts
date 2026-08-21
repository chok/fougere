/**
 * Additive presentation changes over the model derived from `rpc.discover`.
 *
 * An extension names only what it changes. It never snapshots a resource, its fields,
 * or its operations, so a field added to the entity tomorrow still appears in the
 * admin. Ordered extensions compose; the last explicit value wins.
 *
 * **It cannot remove a resource or an operation, and that absence is the design.**
 * Both used to carry `hidden`, which hid in the browser what the façade still served
 * — read by anyone as a permission, and enforcing nothing. Membership already has a
 * mechanism: a named surface says what a door serves to one audience, the card
 * answers restricted, and the admin renders what it was told. So the remedy is an
 * endpoint (`/_fougere/call/admin`), not a flag here. A FIELD may still be hidden:
 * that one changes nothing about what is reachable, only about what is drawn.
 */
import type { FormField, TableColumn } from '@fougere/app/client';
import { capabilitiesOf, type AdminOperation, type AdminResource } from './resources.js';
import { mergeAdminFacets, type AdminFacets } from './facets.js';

export interface AdminFieldExtension {
  /** Changes the fallback in every derived view of this field. */
  label?: string;
  /** Removes the field from derived tables, shows and forms. */
  hidden?: boolean;
}

export interface AdminOperationExtension {
  label?: string;
  /** `false` explicitly removes a confirmation added by an earlier extension. */
  confirm?: string | false;
}

export interface AdminExtension {
  /** Registration key from the card (`post`, not `Post`). */
  resource: string;
  label?: string;
  /** Adds or refines semantic notions without replacing the derived resource. */
  facets?: AdminFacets;
  fields?: Record<string, AdminFieldExtension>;
  operations?: Record<string, AdminOperationExtension>;
}

/** Typed identity helper for extensions kept in their own module. */
export function defineAdminExtension<const T extends AdminExtension>(extension: T): T {
  return extension;
}

function mergeExtensions(extensions: readonly AdminExtension[]): Omit<AdminExtension, 'resource'> {
  const merged: Omit<AdminExtension, 'resource'> = {};
  for (const extension of extensions) {
    if (extension.label !== undefined) merged.label = extension.label;
    if (extension.facets !== undefined) {
      merged.facets = mergeAdminFacets(merged.facets ?? {}, extension.facets);
    }
    if (extension.fields) {
      merged.fields ??= {};
      for (const [name, patch] of Object.entries(extension.fields)) {
        merged.fields[name] = { ...merged.fields[name], ...patch };
      }
    }
    if (extension.operations) {
      merged.operations ??= {};
      for (const [name, patch] of Object.entries(extension.operations)) {
        merged.operations[name] = { ...merged.operations[name], ...patch };
      }
    }
  }
  return merged;
}

function extendFields<T extends FormField | TableColumn>(
  fields: readonly T[],
  patches: AdminExtension['fields'],
): T[] {
  return fields.flatMap((field) => {
    const patch = patches?.[field.name];
    if (patch?.hidden) return [];
    return [{ ...field, ...(patch?.label !== undefined ? { label: patch.label } : {}) }];
  });
}

function extendOperations(
  operations: readonly AdminOperation[],
  patches: AdminExtension['operations'],
): AdminOperation[] {
  return operations.map((operation) => {
    const patch = patches?.[operation.name];
    return {
      ...operation,
      ...(patch?.label !== undefined ? { label: patch.label } : {}),
      ...(patch?.confirm === false
        ? { confirm: undefined }
        : patch?.confirm !== undefined
          ? { confirm: patch.confirm }
          : {}),
    };
  });
}

/** Apply deltas to the latest derived model. Unmentioned and future resources pass through. */
export function applyAdminExtensions(
  resources: readonly AdminResource[],
  extensions: readonly AdminExtension[] = [],
): AdminResource[] {
  const byResource = new Map<string, AdminExtension[]>();
  for (const extension of extensions) {
    const list = byResource.get(extension.resource) ?? [];
    list.push(extension);
    byResource.set(extension.resource, list);
  }

  return resources.map((resource) => {
    const patch = mergeExtensions(byResource.get(resource.name) ?? []);
    const operations = extendOperations(resource.operations, patch.operations);
    return {
      ...resource,
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      facets: mergeAdminFacets(resource.facets, patch.facets ?? {}),
      columns: extendFields(resource.columns, patch.fields),
      fields: extendFields(resource.fields, patch.fields),
      operations,
      can: capabilitiesOf(operations),
    };
  });
}
