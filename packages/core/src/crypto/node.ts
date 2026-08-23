/**
 * Ed25519 through `node:crypto` — the default realization, and the fast one.
 *
 * `sign`/`verify` are synchronous here and stay synchronous: the promise is put around
 * the answer, never around the work. That is the whole reason this file exists rather
 * than everyone sharing the WebCrypto half.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import type { CryptoPort, PublicJwk, Signer, Verifier } from './port.js';

export const crypto: CryptoPort = {
  async sha256(data) {
    return new Uint8Array(createHash('sha256').update(data).digest());
  },

  async signerOf(privateKeyPem): Promise<Signer> {
    // Parsed here and captured, so a call signs against a KeyObject and never a string.
    const key = createPrivateKey(privateKeyPem);
    return { async sign(data) { return new Uint8Array(sign(null, data, key)); } };
  },

  async verifierOf(key): Promise<Verifier> {
    const parsed = typeof key === 'string'
      ? createPublicKey(key)
      : createPublicKey({ key: key as never, format: 'jwk' });
    return { async verify(data, signature) { return verify(null, data, parsed, signature); } };
  },
};

export type { CryptoPort, PublicJwk, Signer, Verifier };
