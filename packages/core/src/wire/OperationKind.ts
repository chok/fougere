/** `query` reads, `command` writes — the same call REST turns into GET vs POST. */
export const OPERATION_KINDS = ['query', 'command'] as const;

export type OperationKind = (typeof OPERATION_KINDS)[number];
