import type { listed } from './Listed.js';
import type { Page } from './Page.js';

/** What one operation of a handler answers, unwrapped; a storage's list reads as a page. */
export type Answer<Handler, Op extends keyof Handler> =
  Handler[Op] extends (...args: never[]) => infer Returned ? Crossed<Awaited<Returned>> : never;

type Crossed<Answered> = typeof listed extends keyof Answered
  ? (Answered extends readonly (infer Row)[] ? Page<Row> : Answered)
  : Answered;
