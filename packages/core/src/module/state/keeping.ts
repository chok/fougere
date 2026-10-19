import { crypto } from '#crypto';
import { b64url } from '../../crypto/encoding.js';
import type { Logger } from '../../builtin/Logger.js';
import { ambient } from '../../slots.js';
import { Seal } from './Seal.js';
import { States, type DeclaredState } from './States.js';

/**
 * What `state:` declares, judged, and the seal its values travel under — the key read from
 * `FOUGERE_STATE_KEY`. None declared, nothing is kept and no key is asked for.
 */
export async function keepingOf(state: Record<string, object> | undefined, log: Logger): Promise<{ declared: DeclaredState[]; seal: Seal } | undefined> {
  const declared = States.declared(state);
  if (declared.length === 0) return undefined;

  let secret = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FOUGERE_STATE_KEY;
  if (!secret) {
    secret = b64url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    log.warn(
      'No FOUGERE_STATE_KEY, so what callers keep is signed with a key that dies with this process: a restart, '
        + 'or a second replica, reads every kept value as absent. Set FOUGERE_STATE_KEY.',
    );
  }
  if (ambient.degraded) {
    log.warn('This runtime has no async context, so state.set is refused. On a Worker, add "nodejs_compat" to compatibility_flags.');
  }

  return { declared, seal: await Seal.under(secret, crypto.macOf) };
}
