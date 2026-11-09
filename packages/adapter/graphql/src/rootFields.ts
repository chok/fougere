import { pluralOf } from '@fougere/schema';
import type { OperationMeta } from './OperationMeta.js';

const claimed = new WeakMap<object, Map<string, string>>();

export function claimRootField(builder: object, fieldName: string, origin: string): void {
  let perField = claimed.get(builder);
  if (!perField) { perField = new Map(); claimed.set(builder, perField); }

  const first = perField.get(fieldName);
  if (first !== undefined && first !== origin) {
    const opName = origin.split('.').pop();
    const remedy = first.split('/')[0] === origin.split('/')[0]
      ? `Both are in the same frond, where \`operations:\` is keyed by op name and cannot `
        + `tell them apart — rename one of the methods.`
      : `Rename one of the methods, or name the field in the frond.config.ts of whichever `
        + `should yield:\n  operations: { ${opName}: { graphql: '…' } }`;
    throw new Error(
      `Two operations have the same GraphQL field \`${fieldName}\`:\n`
      + `  ${first}\n  ${origin}\n`
      + `${remedy}`,
    );
  }
  perField.set(fieldName, origin);
}

/** The root field an operation answers to — what the frond stated, else what its name derives. */
export function rootFieldOf(opName: string, typeName: string, meta: Pick<OperationMeta, 'protocols'>): string {
  return meta.protocols?.graphql ?? graphqlFieldName(opName, typeName);
}

function graphqlFieldName(opName: string, entityName: string): string {
  const nameLower = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const namePlural = pluralOf(nameLower);

  switch (opName) {
    case 'list': return namePlural;
    case 'findById': return nameLower;
    case 'create':
    case 'update':
    case 'delete':
      return `${opName}${entityName}`;
    default:
      return opName;
  }
}
