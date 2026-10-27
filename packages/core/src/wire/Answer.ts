import type { listed } from '../storage/ListResult.js';
import type { Page } from './Page.js';

/**
 * What one operation of a handler answers, unwrapped — the page's row type, never restated. A list
 * a storage answered crosses as the page it is, so it is read as one.
 */
export type Answer<Handler, Op extends keyof Handler> =
  Handler[Op] extends (...args: never[]) => infer Returned ? Crossed<Awaited<Returned>> : never;

/** Declared a storage's list — the mark is a KEY of its type, which a plain array's is not. */
type Crossed<Answered> = typeof listed extends keyof Answered
  ? (Answered extends readonly (infer Row)[] ? Page<Row> : Answered)
  : Answered;
