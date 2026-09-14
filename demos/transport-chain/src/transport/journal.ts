import type { Transport } from '@fougere/core';

/** One crossing that already answered, and what it answered. */
export interface Kept {
  key: string;
  answer: unknown;
}

/** A link that remembers an answer and refuses to ask twice — what a replay engine is made of. */
export function journal(kept: Kept[], inner: Transport): Transport {
  return async (call, invocation) => {
    const key = `${call.entity}.${call.op}`;
    const already = kept.find((one) => one.key === key);
    if (already) return already.answer;

    const answer = await inner(call, invocation);
    kept.push({ key, answer });

    return answer;
  };
}
