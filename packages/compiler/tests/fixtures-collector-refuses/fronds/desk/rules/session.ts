import { ErrorCode, FougereError } from '@fougere/core';

export function signInFirst(): never {
  throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'Sign in first.' });
}
