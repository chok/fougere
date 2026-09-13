import type { ResponseResult } from './ResponseResult.js';

export type Next = () => Promise<ResponseResult>;

/** What `next()` answers when the host framework — not us — owns the chain. */
export const PASSTHROUGH: unique symbol = Symbol('fougere.http.passthrough');
