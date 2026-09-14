/** The two readings core serves everywhere, asked of one process over one transport. */
import { Invocation } from '../wire/Invocation.js';
import { RPC_ENTITY } from '../wire/RpcAnswer.js';
import type { Transport } from '../wire/Transport.js';
import type { Peer } from './Peer.js';

export function peerOver(transport: Transport): Peer {
  const ask = (op: string, params: Record<string, unknown>) =>
    transport({ entity: RPC_ENTITY, op }, { ...Invocation.empty, params: params as never });

  return {
    missing: async (entity, keys) =>
      ((await ask('holds', { entity, keys })) as { missing: readonly unknown[] }).missing,
    dependents: (entity) => ask('dependents', { entity }),
    release: async (entity, key, visited) => { await ask('release', { entity, key, visited }); },
  };
}
