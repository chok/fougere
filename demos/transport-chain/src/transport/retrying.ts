import { ErrorCode, FougereError, type Transport } from '@fougere/core';

/** What says the call never got an answer — a far side draining, or a line that gave out. */
const UNANSWERED: ReadonlySet<string> = new Set([ErrorCode.BAD_GATEWAY, ErrorCode.GATEWAY_TIMEOUT, ErrorCode.SERVICE_UNAVAILABLE]);

/**
 * A link that asks again when the crossing failed, and never when the far side answered. A refusal
 * is an answer: asked twice, it says the same thing twice.
 */
export function retrying(times: number, inner: Transport): Transport {
  return async (call, invocation) => {
    let failed: unknown;
    for (let attempt = 0; attempt <= times; attempt += 1) {
      try {
        return await inner(call, invocation);
      } catch (cause) {
        if (cause instanceof FougereError && !UNANSWERED.has(cause.code)) throw cause;
        failed = cause;
      }
    }

    throw failed;
  };
}
