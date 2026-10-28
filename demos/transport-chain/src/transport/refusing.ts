import { ErrorCode, FougereError, type Transport } from '@fougere/core';

/** The far side answering no on one operation — the call crossed, and a refusal came back. */
export function refusing(op: string, inner: Transport): Transport {
  return async (call, invocation) => {
    const answer = await inner(call, invocation);
    if (call.op === op) throw new FougereError({ code: ErrorCode.CONFLICT, message: `the far side refused ${call.address}.${call.op}` });

    return answer;
  };
}
