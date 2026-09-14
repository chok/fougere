/** A parsed public key. */
export interface Verifier {
  /** False, never a throw: a bad signature is an answer, not a failure. */
  verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
}
