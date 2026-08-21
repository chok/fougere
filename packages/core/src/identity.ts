/**
 * Who is calling — the proof, not the claim.
 *
 * `InvocationContext.state` is what a caller SAYS about itself, and a split receiver
 * used to believe it: identity read straight off the wire, so a reader could post
 * `{ state: { user: { role: 'admin' } } }` and be one. This module is what turns that
 * sack into something a receiver establishes instead of accepts.
 *
 * Two signatures, one public key to distribute:
 *
 *   GRANT      the root says "this key is `blog`"   — issued once, at deployment
 *   ENVELOPE   `blog` says "here is my whole call"   — signed per call
 *
 * The envelope binds the CALL and not only its state: address, params, query, a digest
 * of the body. Signing the state alone proved WHO without proving WHAT, so anyone on the
 * wire could replay a captured envelope against another operation for as long as it
 * stayed valid — `post.list` re-sent as `post.delete`, same signature, still good.
 *
 * A receiver holds the root's public key and nothing else: it validates any frond it
 * has never seen, which is what a per-caller list could not do. The private root key
 * signs grants and never leaves the machine that issued them.
 *
 * Ed25519 and a JWS-shaped grant rather than X.509: node can PARSE a certificate but
 * not ISSUE one, so a real chain would mean openssl or a library. The grant says the
 * same thing — a name bound to a public key, signed by the root — with node:crypto
 * alone, which is what keeps this package and the CLI dependency-free.
 */
import { createHash, createPublicKey, createPrivateKey, generateKeyPairSync, sign, verify, type JsonWebKey, type KeyObject } from 'node:crypto';
import type { SignedCall } from './wire/call.js';

export type { SignedCall } from './wire/call.js';

/** How long a call envelope stays valid. A signed call is not a session. */
const ENVELOPE_TTL_MS = 60_000;
/** Clock skew tolerated on both sides of a validity window. */
const SKEW_MS = 30_000;

/** What a deployment hands a frond that CALLS: its own key, and the root's word for it. */
export interface FrondIdentity {
  /** The frond's private key, PEM (PKCS#8). */
  privateKey: string;
  /** The root's statement binding this frond's name to its public key. */
  grant: string;
}

/** The body's fingerprint. `null` and an absent body are the same call. */
function digestOf(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('base64url');
}

/** What the envelope pins, as one comparable value. */
function boundTo(call: SignedCall) {
  return {
    entity: call.entity,
    op: call.op,
    params: call.params ?? {},
    query: call.query ?? {},
    body: digestOf(call.body),
  };
}

/** What `verifyEnvelope` establishes — never what the caller asked for. */
export interface VerifiedCall {
  /** The frond that signed, as the root named it. */
  caller: string;
  /** The state it asserted, now proven to come from `caller`. */
  state: Record<string, unknown>;
}

const b64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url');
const unb64url = (input: string): Buffer => Buffer.from(input, 'base64url');

/** A JWS compact serialization, signed with Ed25519. */
function signJws(header: object, payload: object, key: KeyObject): string {
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${signingInput}.${b64url(sign(null, Buffer.from(signingInput), key))}`;
}

/**
 * The payload, once the signature holds. Throws rather than returning a falsy value:
 * every caller here is deciding whether to admit a call, and an unverified payload
 * must never be reachable by forgetting a check.
 */
function verifyJws(token: string, key: KeyObject, what: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error(`Malformed ${what}`);
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!verify(null, Buffer.from(`${encodedHeader}.${encodedPayload}`), key, unb64url(encodedSignature))) {
    throw new Error(`Bad ${what} signature`);
  }
  const payload = JSON.parse(unb64url(encodedPayload).toString()) as Record<string, unknown>;
  const now = Date.now();
  if (typeof payload.exp === 'number' && now > payload.exp + SKEW_MS) throw new Error(`Expired ${what}`);
  if (typeof payload.nbf === 'number' && now < payload.nbf - SKEW_MS) throw new Error(`${what} not yet valid`);
  return payload;
}

/** Read a JWS header without verifying anything — only to find which key to verify WITH. */
function headerOf(token: string): Record<string, unknown> {
  const encodedHeader = token.split('.')[0];
  if (!encodedHeader) throw new Error('Malformed envelope');
  return JSON.parse(unb64url(encodedHeader).toString()) as Record<string, unknown>;
}

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
  return signJws(
    { alg: 'EdDSA', typ: 'fougere-grant' },
    { sub: name, jwk, iat: now, exp: now + ttlDays * 86_400_000 },
    createPrivateKey(rootPrivateKey),
  );
}

/** Sign one call, whole: who is asking, what is asked, and on whose behalf. */
export function signEnvelope(identity: FrondIdentity, call: SignedCall): string {
  const now = Date.now();
  const { sub } = JSON.parse(unb64url(identity.grant.split('.')[1]).toString()) as { sub: string };
  return signJws(
    { alg: 'EdDSA', typ: 'fougere-call', grant: identity.grant },
    { iss: sub, state: call.state ?? {}, bound: boundTo(call), iat: now, exp: now + ENVELOPE_TTL_MS },
    createPrivateKey(identity.privateKey),
  );
}

/**
 * Establish the caller, or throw. Order matters: the grant is checked against the ROOT
 * first, and only the key it carries verifies the envelope — reading the envelope's own
 * claim of who it is before that would be believing the thing under examination.
 */
export function verifyEnvelope(token: string, rootPublicKey: string, presented: SignedCall): VerifiedCall {
  const { grant } = headerOf(token);
  if (typeof grant !== 'string') throw new Error('Envelope carries no grant');

  const granted = verifyJws(grant, createPublicKey(rootPublicKey), 'grant');
  if (typeof granted.sub !== 'string' || typeof granted.jwk !== 'object' || granted.jwk === null) {
    throw new Error('Grant names no frond');
  }

  const callerKey = createPublicKey({ key: granted.jwk as JsonWebKey, format: 'jwk' });
  const payload = verifyJws(token, callerKey, 'envelope');

  // The grant is the authority on the name; the envelope only repeats it. They disagree
  // when a frond signs under someone else's name with its own key.
  if (payload.iss !== granted.sub) throw new Error(`Envelope signed by '${granted.sub}' claims to be '${String(payload.iss)}'`);

  // The signature says this envelope was made by `blog`; this says it was made for THIS
  // call. Without it a captured envelope is a blank cheque until it expires.
  const bound = JSON.stringify(payload.bound);
  if (bound !== JSON.stringify(boundTo(presented))) {
    throw new Error(`Envelope was signed for a different call than ${presented.entity}.${presented.op}`);
  }

  return {
    caller: granted.sub,
    state: (payload.state as Record<string, unknown>) ?? {},
  };
}

/** The two halves a boot needs, and the environment they come from. */
export interface CallIdentity {
  /** Signs an outgoing call, whole. Absent when this process holds no key — it only answers. */
  sign?: (call: SignedCall) => string;
  /** Establishes an incoming caller, against the call that actually arrived. */
  verify?: (identity: string, presented: SignedCall) => VerifiedCall;
  /** Refuse an unsigned call. True exactly when a root is trusted. */
  requireIdentity: boolean;
}

/**
 * A PEM, however the deployment chose to carry it.
 *
 * A PEM is multi-line and an environment variable that spans lines survives poorly —
 * docker-compose, systemd and CI secret stores each mangle it differently — so
 * `fougere keys` prints base64. Both forms are read here rather than one being decreed:
 * a human pasting a real PEM is not making a mistake.
 */
function pemOf(value: string): string {
  return value.trimStart().startsWith('-----') ? value : Buffer.from(value, 'base64').toString('utf8');
}

/**
 * What the deployment injected, read once at boot.
 *
 * Three variables, no config key: a private key never belongs in a committed file, and
 * `fougere keys` prints exactly these. A process may hold either half or both — a frond
 * that only answers has no key, one that only calls trusts no root, one in the middle
 * does both.
 *
 * Trusting a root IS asking to refuse: there is no separate flag, because a deployment
 * that names an authority and then accepts unsigned calls has said two things at once.
 */
export function identityFromEnv(env: Record<string, string | undefined> = process.env): CallIdentity {
  const root = env.FOUGERE_ROOT ? pemOf(env.FOUGERE_ROOT) : undefined;
  const privateKey = env.FOUGERE_KEY ? pemOf(env.FOUGERE_KEY) : undefined;
  const grant = env.FOUGERE_GRANT;

  return {
    ...(privateKey && grant ? { sign: (call: SignedCall) => signEnvelope({ privateKey, grant }, call) } : {}),
    ...(root ? { verify: (identity: string, presented: SignedCall) => verifyEnvelope(identity, root, presented) } : {}),
    requireIdentity: Boolean(root),
  };
}
