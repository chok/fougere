import { ErrorCode } from './ErrorCode.js';
import type { OperationKind } from './OperationKind.js';

/** The little of an operation this reads — so a card op and an effective one both fit. */
export interface Refusable {
  kind?: OperationKind;
  input?: unknown;
  errors?: readonly string[];
  /** Absent on a card op read from a frond that answers in this process. */
  remote?: boolean;
}

const IMPLIED: { code: ErrorCode; when: (op: Refusable) => boolean }[] = [
  { code: ErrorCode.SERVICE_UNAVAILABLE, when: () => true },
  { code: ErrorCode.VALIDATION_FAILED, when: (op) => op.input !== undefined },
  { code: ErrorCode.BAD_REQUEST, when: (op) => op.kind === 'command' },
  { code: ErrorCode.GATEWAY_TIMEOUT, when: (op) => op.remote === true },
  { code: ErrorCode.BAD_GATEWAY, when: (op) => op.remote === true },
];

/** Every code one operation can answer with, declared and implied, sorted. */
export function refusalsOf(op: Refusable): ErrorCode[] {
  const implied = IMPLIED.filter((one) => one.when(op)).map((one) => one.code);

  return [...new Set([...(op.errors ?? []) as ErrorCode[], ...implied])].sort();
}
