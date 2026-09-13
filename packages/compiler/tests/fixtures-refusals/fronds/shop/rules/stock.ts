import { FougereError, ErrorCode } from '@fougere/core';

/** A guard in a neighbouring MODULE — reached by an import, not by sitting in the same file. */
export function requireStock(left: number, operation: string): void {
  if (left < 1) throw new FougereError({ code: ErrorCode.UNPROCESSABLE_ENTITY, message: 'out of stock', operation });
}
