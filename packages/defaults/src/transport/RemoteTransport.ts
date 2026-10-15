import { identityFromEnv, type Transport } from '@fougere/core';
import { createHttpTransport } from '@fougere/transport-http';

/** How a call reaches a frond `fronds:` places at an address — HTTP, signed when the deployment gave a key. */
export async function remoteTransport(): Promise<(url: string) => Transport> {
  const { sign } = await identityFromEnv();

  return (url) => createHttpTransport(url, sign ? { sign } : {});
}
