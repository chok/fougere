/** Ed25519 through WebCrypto — what a runtime with no `node:` builtin has. */
import { derOf } from './encoding.js';
import type { CryptoPort, PublicJwk, Signer, Verifier } from './port.js';

interface WebSubtle {
  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
  importKey(
    format: 'pkcs8' | 'spki' | 'jwk',
    key: Uint8Array | PublicJwk,
    algorithm: { name: string },
    extractable: boolean,
    usages: string[],
  ): Promise<unknown>;
  sign(algorithm: { name: string }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
  verify(algorithm: { name: string }, key: unknown, signature: Uint8Array, data: Uint8Array): Promise<boolean>;
}

const ED25519 = { name: 'Ed25519' } as const;

/** Read at call time — a Worker has the global, and reading it at module load does not. */
const subtle = (): WebSubtle =>
  (globalThis as unknown as { crypto: { subtle: WebSubtle } }).crypto.subtle;

export const crypto: CryptoPort = {
  async sha256(data) {
    return new Uint8Array(await subtle().digest('SHA-256', data));
  },

  async signerOf(privateKeyPem): Promise<Signer> {
    // Imported once, at boot. Doing it per call would put an async key parse inside
    // every outgoing request — the reason the port hands back a signer at all.
    const key = await subtle().importKey('pkcs8', derOf(privateKeyPem), ED25519, false, ['sign']);
    return { async sign(data) { return new Uint8Array(await subtle().sign(ED25519, key, data)); } };
  },

  async verifierOf(key): Promise<Verifier> {
    const imported = typeof key === 'string'
      ? await subtle().importKey('spki', derOf(key), ED25519, false, ['verify'])
      : await subtle().importKey('jwk', key, ED25519, false, ['verify']);
    return { verify: (data, signature) => subtle().verify(ED25519, imported, signature, data) };
  },
};

export type { CryptoPort, PublicJwk, Signer, Verifier };
