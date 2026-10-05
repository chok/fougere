import type { OperationContract } from '../wire/OperationContract.js';

/** The contracts a class carries on itself — `Crud(Post)` states its five as `__ops`. */
export function opsOf(ctor: unknown): Record<string, OperationContract> {
  return (ctor as { __ops?: Record<string, OperationContract> }).__ops ?? {};
}
