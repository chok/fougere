import type { Fields } from '@fougere/schema';
import { OutputProjector } from '../dispatch/OutputProjector.js';
import { OutputView } from '../dispatch/OutputView.js';
import { PresenterExecutor, type PresenterArgs } from '../dispatch/PresenterExecutor.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';

/** Compatibility function while call sites move to OutputProjector. */
export function projectEgress(fields: Fields, result: unknown, closed = false): unknown {
  return new OutputProjector(new OutputView(fields, closed)).project(result);
}

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
