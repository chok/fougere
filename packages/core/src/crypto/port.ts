/** The two Ed25519 gestures a signed call needs, and the one hash that binds it. */

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
