/** What a deployment hands a frond that CALLS: its own key, and the root's word for it. */
export interface FrondIdentity {
  /** The frond's private key, PEM (PKCS#8). */
  privateKey: string;
  /** The root's statement binding this frond's name to its public key. */
  grant: string;
}
