import type { Fields } from '@fougere/schema';
import { PresenterExecutor, type PresenterArgs } from '../dispatch/PresenterExecutor.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';

export type { PresenterArgs } from '../dispatch/PresenterExecutor.js';

/** Compatibility function while call sites move to PresenterExecutor. */
export async function presentEgress(
  result: unknown,
  presenter: Record<string, unknown> | undefined,
  fieldNames: string[] | undefined,
  entity = 'unknown',
  operation = 'unknown',
  args: PresenterArgs = {},
): Promise<unknown> {
  return new PresenterExecutor(presenter, fieldNames, entity, operation).present(result, args);
}

/** Compatibility function while storage wiring moves to StorageGuard. */
export function guardStorage<T extends object>(orm: T, fields: Fields, entityName: string): T {
  return new StorageGuard(fields, entityName).guard(orm);
}
