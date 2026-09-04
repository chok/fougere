/** Making keys and issuing grants — the half of identity that runs at a DEPLOYMENT. */
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { b64url } from './crypto/encoding.js';

/** A fresh Ed25519 pair, PEM both ways. The root's and a frond's are the same kind. */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/**
 * Bind a name to a public key, signed by the root — the whole of what a receiver needs to
 * recognize a frond it has never seen.
 */
export function issueGrant(
  rootPrivateKey: string,
  name: string,
  frondPublicKey: string,
  ttlDays = 90,
): string {
  const jwk = createPublicKey(frondPublicKey).export({ format: 'jwk' });
  const now = Date.now();
  const header = b64url(JSON.stringify({ alg: 'EdDSA', typ: 'fougere-grant' }));
  const payload = b64url(JSON.stringify({ sub: name, jwk, iat: now, exp: now + ttlDays * 86_400_000 }));
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${b64url(new Uint8Array(sign(null, Buffer.from(signingInput), createPrivateKey(rootPrivateKey))))}`;
}
