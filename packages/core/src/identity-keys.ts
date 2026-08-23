/**
 * Making keys and issuing grants — the half of identity that runs at a DEPLOYMENT.
 *
 * It sits on the Node entry because it is the CLI speaking: `fougere keys` generates a
 * pair, `fougere grant` binds a name to one, and both happen once, on a machine with a
 * filesystem. Neither is reachable from a request path, so nothing here is on any hot
 * path and `generateKeyPairSync` — the one gesture WebCrypto could not replace without
 * changing what a key IS — never has to leave `node:crypto`.
 *
 * The verifying half is elsewhere (`identity.ts`) because it runs per call, everywhere.
 */
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
 * Bind a name to a public key, signed by the root — the whole of what a receiver
 * needs to recognize a frond it has never seen.
 *
 * `ttlDays` bounds the damage of a leaked frond key without a revocation list:
 * re-issuing is a deployment, which is the same gesture that leaked it.
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
