/**
 * The two Ed25519 gestures a signed call needs, and the one hash that binds it.
 *
 * Node signs 59% faster than WebCrypto on the same curve (measured 2026-08-23: 14.30 µs
 * against 22.72 µs per signature, 34.42 against 41.81 to verify), so this is a PORT with
 * two realizations and not one implementation at the lowest common denominator. `#crypto`
 * resolves to `crypto/node.ts` everywhere except under the `workerd` condition — the
 * bundler picks at build time, and neither half ever appears in the other's output.
 *
 * The shape is async because WebCrypto is. On Node that costs one microtask, which the
 * same measurement puts inside the noise of the signature itself (14.30 sync against
 * 14.28 awaited) — awaiting is free, converting is not.
 *
 * A KEY IS PARSED ONCE. `crypto.subtle.importKey` is async and per-key, so an interface
 * shaped `sign(key, data)` would import on every call; `signerOf(pem)` hands back
 * something that holds the parsed key, and a boot builds it once.
 */

/** A parsed private key. */
export interface Signer {
  sign(data: Uint8Array): Promise<Uint8Array>;
}

/** A parsed public key. */
export interface Verifier {
  /** False, never a throw: a bad signature is an answer, not a failure. */
  verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
}

/** A public key as a grant carries it — `{ kty: 'OKP', crv: 'Ed25519', x }`. */
export interface PublicJwk {
  kty: string;
  crv?: string;
  x?: string;
  [key: string]: unknown;
}

export interface CryptoPort {
  /** SHA-256. What binds a body to an envelope without carrying the body. */
  sha256(data: Uint8Array): Promise<Uint8Array>;
  /** From a PKCS#8 PEM — what `fougere keys` writes. */
  signerOf(privateKeyPem: string): Promise<Signer>;
  /** From an SPKI PEM (the root's) or a JWK (the one a grant embeds). */
  verifierOf(key: string | PublicJwk): Promise<Verifier>;
}
