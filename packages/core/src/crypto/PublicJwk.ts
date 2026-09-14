/** A public key as a grant carries it — `{ kty: 'OKP', crv: 'Ed25519', x }`. */
export interface PublicJwk {
  kty: string;
  crv?: string;
  x?: string;
  [key: string]: unknown;
}
