import type { IdentityCard } from '@fougere/core';

/**
 * Asking a host for its card — the dual of `identityCardOf`, which produces one.
 *
 * There is no side endpoint: `rpc.discover` rides the call endpoint every consumer
 * already speaks to, so a host that answers calls answers this by construction. Two
 * commands need it — one to write the contract down, one to check it still holds — and
 * a second copy of this request is how the CLI's private card interface went stale.
 */
export default class RemoteCard {
  /** Reject anything that is not an http(s) origin, and drop a trailing slash. */
  originOf(from: string): string {
    let url: URL;
    try {
      url = new URL(from);
    } catch {
      throw new Error(`Invalid remote URL '${from}'`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Remote URL must use http or https, got '${url.protocol}'`);
    }
    return url.toString().replace(/\/$/, '');
  }

  async fetch(from: string): Promise<{ baseUrl: string; card: IdentityCard }> {
    const baseUrl = this.originOf(from);
    const res = await globalThis.fetch(`${baseUrl}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc.discover', params: { params: {}, query: {}, state: {} } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Failed to reach ${baseUrl}/_fougere/call: ${res.status} ${res.statusText}`);
    }
    const rpc = (await res.json()) as { result?: IdentityCard; error?: { message: string } };
    if (rpc.error) throw new Error(`Remote error: ${rpc.error.message}`);
    if (!rpc.result || !Array.isArray(rpc.result.fronds)) {
      throw new Error('Remote rpc.discover returned an invalid identity card');
    }
    return { baseUrl, card: rpc.result };
  }
}
