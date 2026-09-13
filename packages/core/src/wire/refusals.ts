/**
 * What a call to one operation can come back refusing — both halves, put together where they
 * are read rather than where they are published.
 *
 * The half the FRAMEWORK owns is not on the wire, because it follows from facts that already
 * are: an op with an `input` is judged at the facade, an op that is dispatched at all can meet a
 * draining app, an op that crosses a process can meet the wire. Writing those beside every
 * operation would be one fact in two places — and the card would grow by three entries per op
 * that a reader can work out from `kind` and `input`.
 *
 * The half the FROND owns travels, because nothing else implies it: that `publish` answers
 * `CONFLICT` is a domain decision, and it is read off the code by the scan's walk.
 *
 * Documented: [observability](https://fougere.dev/docs/infra/observability).
 */
import { ErrorCode } from './errors.js';

/** The little of an operation this reads — so a card op and an effective one both fit. */
export interface Refusable {
  kind?: 'query' | 'command';
  input?: unknown;
  errors?: readonly string[];
  /** Absent on a card op read from a frond that answers in this process. */
  remote?: boolean;
}

/**
 * What the framework refuses, and the fact each one follows from. Every line is a claim about
 * the core, held by a test rather than by memory: the day a facade stops judging, the claim fails
 * before a contract starts lying.
 */
const IMPLIED: { code: ErrorCode; when: (op: Refusable) => boolean }[] = [
  // `InFlight.enter` — a call arriving after the facade closed, which any op can meet.
  { code: ErrorCode.SERVICE_UNAVAILABLE, when: () => true },
  // `validateInput` — it returns the invocation untouched when the op declares no view.
  { code: ErrorCode.VALIDATION_FAILED, when: (op) => op.input !== undefined },
  // `StorageGuard` — it judges what a handler writes, so a reading op never meets it.
  { code: ErrorCode.BAD_REQUEST, when: (op) => op.kind === 'command' },
  // The transport, and `boot/remote` behind it. Only a call that leaves can fail to arrive.
  { code: ErrorCode.GATEWAY_TIMEOUT, when: (op) => op.remote === true },
  { code: ErrorCode.BAD_GATEWAY, when: (op) => op.remote === true },
];

/**
 * Every code one operation can answer with, sorted — the declared ones and the implied ones.
 *
 * `INTERNAL_ERROR` is in neither: its message never leaves (`toPublicError` replaces it), so it
 * is a bug rather than a refusal, and a contract that named it would tell a caller nothing it
 * could act on.
 */
export function refusalsOf(op: Refusable): ErrorCode[] {
  const implied = IMPLIED.filter((one) => one.when(op)).map((one) => one.code);

  return [...new Set([...(op.errors ?? []) as ErrorCode[], ...implied])].sort();
}
