import type { Signer } from './Signer.js';
import type { Verifier } from './Verifier.js';
import type { PublicJwk } from './PublicJwk.js';

export interface CryptoPort {
  /** SHA-256. What binds an input to an envelope without carrying the input. */
  sha256(data: Uint8Array): Promise<Uint8Array>;
  /** From a PKCS#8 PEM — what `fougere keys` writes. */
  signerOf(privateKeyPem: string): Promise<Signer>;
  /** From an SPKI PEM (the root's) or a JWK (the one a grant embeds). */
  verifierOf(key: string | PublicJwk): Promise<Verifier>;
}
