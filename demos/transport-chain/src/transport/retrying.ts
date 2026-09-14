import type { Transport } from '@fougere/core';

/** A link that asks again. It knows nothing of who it wraps, which is why it can wrap anyone. */
export function retrying(times: number, inner: Transport): Transport {
  return async (call, invocation) => {
    let refused: unknown;
    for (let attempt = 0; attempt <= times; attempt += 1) {
      try {
        return await inner(call, invocation);
      } catch (cause) {
        refused = cause;
      }
    }

    throw refused;
  };
}
