import type { FormField, TableColumn } from '@fougere/app/client';
import { type AdminOperation } from './AdminOperation.js';
import { capabilitiesOf, type AdminResource } from './AdminResource.js';
import { mergeAdminFacets, type AdminFacets } from './AdminFacets.js';
import type { AdminFieldExtension } from './AdminFieldExtension.js';
import type { AdminOperationExtension } from './AdminOperationExtension.js';

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
