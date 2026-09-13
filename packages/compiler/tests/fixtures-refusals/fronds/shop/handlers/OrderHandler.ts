import { FougereError, ErrorCode } from '@fougere/core';

/**
 * The guard lives BESIDE the handler, which is the whole point of the walk: reading the method's
 * own body would find one refusal here and miss two.
 */
function requirePaid(paid: boolean, operation: string): void {
  if (!paid) throw new FougereError({ code: ErrorCode.PRECONDITION_FAILED, message: 'unpaid', operation });
}

function requireOpen(closed: boolean, operation: string): void {
  if (closed) throw new FougereError({ code: ErrorCode.GONE, message: 'closed', operation });
  requirePaid(true, operation);
}

export default class OrderHandler {
  /** Two hops away: ship → requireOpen → requirePaid. */
  async ship(): Promise<void> {
    requireOpen(false, 'ship');
    throw new FougereError({ code: ErrorCode.CONFLICT, message: 'already shipped', operation: 'ship' });
  }

  /** Reaches nothing that refuses — an op with no refusal of its own is the ordinary case. */
  async quote(): Promise<number> {
    return 1;
  }

  /** A masked refusal is not a contract: its message never leaves. */
  async audit(): Promise<void> {
    throw new FougereError({ code: ErrorCode.INTERNAL_ERROR, message: 'nope', operation: 'audit' });
  }
}
