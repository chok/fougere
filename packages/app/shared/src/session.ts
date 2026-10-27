/** Who is signed in, as a page reads it — asked of the auth frond, which answers `session.get`. */
import { ErrorCode, FougereError, type FrondCall } from '@fougere/core/contract';
import { invocationOf, sendCall } from './Designation.js';
import type { Fetcher } from './Fetcher.js';

export interface SessionView {
  user: Record<string, unknown> | null;
}

export const SESSION_CALL: FrondCall = { address: 'session', op: 'get' };

/** Nobody is signed in where no frond answers who is — an app with no auth has no user. */
export function nobodyWhenUnserved(failure: unknown): SessionView {
  if (failure instanceof FougereError && failure.code === ErrorCode.NOT_FOUND) return { user: null };
  throw failure;
}

/** The session, asked through the envelope a page calls everything else through. */
export async function sessionOf(fetcher: Fetcher): Promise<SessionView> {
  try {
    return { user: (await sendCall(fetcher, SESSION_CALL, invocationOf())) as SessionView['user'] ?? null };
  } catch (failure) {
    return nobodyWhenUnserved(failure);
  }
}
