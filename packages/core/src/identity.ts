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
 * same thing — a name bound to a public key, signed by the root — with no dependency.
 *
 * The Ed25519 itself comes through `#crypto`, which has two realizations: `node:crypto`
 * everywhere, WebCrypto under `workerd`. Everything here is therefore async — WebCrypto
 * has no synchronous form — and a key is parsed ONCE, into a `Signer` or a `Verifier`,
 * never per call. Making the keys and issuing grants happen at a deployment and live in
 * `identity-keys.ts`, on the Node entry.
 */
import { crypto } from '#crypto';
import type { PublicJwk, Signer, Verifier } from './crypto/port.js';
import { b64url, unb64url, bytesOf, textOf, unb64 } from './crypto/encoding.js';
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

/** The body's fingerprint. Absence and explicit null are different signed calls. */
async function digestOf(body: unknown): Promise<string> {
  // The tag is outside the caller value, so no user object can collide with it. JSON's
  // own omission rule still applies inside `value`, matching what crosses the wire.
  const canonical = body === undefined
    ? { kind: 'undefined' }
    : { kind: 'value', value: body };
  return b64url(await crypto.sha256(bytesOf(JSON.stringify(canonical))));
}

/** What the envelope pins, as one comparable value. */
async function boundTo(call: SignedCall) {
  return {
    entity: call.entity,
    op: call.op,
    params: call.params ?? {},
    query: call.query ?? {},
    body: await digestOf(call.body),
  };
}

/** What `verifyEnvelope` establishes — never what the caller asked for. */
export interface VerifiedCall {
  /** The frond that signed, as the root named it. */
  caller: string;
  /** The state it asserted, now proven to come from `caller`. */
  state: Record<string, unknown>;
}

/** A JWS compact serialization, signed with Ed25519. */
async function signJws(header: object, payload: object, signer: Signer): Promise<string> {
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${signingInput}.${b64url(await signer.sign(bytesOf(signingInput)))}`;
}

/**
 * The payload, once the signature holds. Throws rather than returning a falsy value:
 * every caller here is deciding whether to admit a call, and an unverified payload
 * must never be reachable by forgetting a check.
 */
async function verifyJws(token: string, verifier: Verifier, what: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error(`Malformed ${what}`);
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!await verifier.verify(bytesOf(`${encodedHeader}.${encodedPayload}`), unb64url(encodedSignature))) {
    throw new Error(`Bad ${what} signature`);
  }
  const payload = JSON.parse(textOf(unb64url(encodedPayload))) as Record<string, unknown>;
  const now = Date.now();
  if (typeof payload.exp === 'number' && now > payload.exp + SKEW_MS) throw new Error(`Expired ${what}`);
  if (typeof payload.nbf === 'number' && now < payload.nbf - SKEW_MS) throw new Error(`${what} not yet valid`);
  return payload;
}

/** Read a JWS header without verifying anything — only to find which key to verify WITH. */
function headerOf(token: string): Record<string, unknown> {
  const encodedHeader = token.split('.')[0];
  if (!encodedHeader) throw new Error('Malformed envelope');
  return JSON.parse(textOf(unb64url(encodedHeader))) as Record<string, unknown>;
}

/**
 * Sign one call, whole: who is asking, what is asked, and on whose behalf.
 *
 * The private key is parsed on every call here, which is the convenience form. A process
 * that signs in a request path builds its signer once — `identityFromEnv` does exactly
 * that, and `sign` on the value it returns holds the parsed key.
 */
export async function signEnvelope(identity: FrondIdentity, call: SignedCall): Promise<string> {
  return sealWith(await crypto.signerOf(identity.privateKey), identity.grant, call);
}

/** The same envelope, against a key someone already parsed. */
async function sealWith(signer: Signer, grant: string, call: SignedCall): Promise<string> {
  const now = Date.now();
  const { sub } = JSON.parse(textOf(unb64url(grant.split('.')[1]))) as { sub: string };
  return signJws(
    { alg: 'EdDSA', typ: 'fougere-call', grant },
    { iss: sub, state: call.state ?? {}, bound: await boundTo(call), iat: now, exp: now + ENVELOPE_TTL_MS },
    signer,
  );
}

/**
 * Establish the caller, or throw. Order matters: the grant is checked against the ROOT
 * first, and only the key it carries verifies the envelope — reading the envelope's own
 * claim of who it is before that would be believing the thing under examination.
 */
export async function verifyEnvelope(token: string, rootPublicKey: string, presented: SignedCall): Promise<VerifiedCall> {
  return openWith(await crypto.verifierOf(rootPublicKey), token, presented);
}

/** The same check, against a root key someone already parsed. */
async function openWith(root: Verifier, token: string, presented: SignedCall): Promise<VerifiedCall> {
  const { grant } = headerOf(token);
  if (typeof grant !== 'string') throw new Error('Envelope carries no grant');

  const granted = await verifyJws(grant, root, 'grant');
  if (typeof granted.sub !== 'string' || typeof granted.jwk !== 'object' || granted.jwk === null) {
    throw new Error('Grant names no frond');
  }

  const payload = await verifyJws(token, await crypto.verifierOf(granted.jwk as PublicJwk), 'envelope');

  // The grant is the authority on the name; the envelope only repeats it. They disagree
  // when a frond signs under someone else's name with its own key.
  if (payload.iss !== granted.sub) throw new Error(`Envelope signed by '${granted.sub}' claims to be '${String(payload.iss)}'`);

  // The signature says this envelope was made by `blog`; this says it was made for THIS
  // call. Without it a captured envelope is a blank cheque until it expires.
  const bound = JSON.stringify(payload.bound);
  if (bound !== JSON.stringify(await boundTo(presented))) {
    throw new Error(`Envelope was signed for a different call than ${presented.entity}.${presented.op}`);
  }

  return {
    caller: granted.sub,
    state: (payload.state as Record<string, unknown>) ?? {},
  };
}

/** The two halves a boot needs, and the environment they come from. */
export interface CallIdentity {
  /**
   * Signs an outgoing call, whole. Absent when this process holds no key — it only answers.
   *
   * A promise because WebCrypto has no synchronous form. On Node the work stays
   * synchronous inside and only the answer is wrapped: measured at 14.28 µs awaited
   * against 14.30 µs called directly, while WebCrypto on the same curve costs 22.72.
   */
  sign?: (call: SignedCall) => Promise<string>;
  /** Establishes an incoming caller, against the call that actually arrived. */
  verify?: (identity: string, presented: SignedCall) => Promise<VerifiedCall>;
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
  return value.trimStart().startsWith('-----') ? value : textOf(unb64(value));
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
export async function identityFromEnv(env: Record<string, string | undefined> = envOfProcess()): Promise<CallIdentity> {
  const root = env.FOUGERE_ROOT ? pemOf(env.FOUGERE_ROOT) : undefined;
  const privateKey = env.FOUGERE_KEY ? pemOf(env.FOUGERE_KEY) : undefined;
  const grant = env.FOUGERE_GRANT;

  // Async because the keys are parsed HERE, once, and both closures below capture the
  // result: importing a key is per-key work, and a per-call import would put it inside
  // every request. This is the one gesture a boot pays for.
  const signer = privateKey ? await crypto.signerOf(privateKey) : undefined;
  const rootKey = root ? await crypto.verifierOf(root) : undefined;

  return {
    ...(signer && grant ? { sign: (call: SignedCall) => sealWith(signer, grant, call) } : {}),
    ...(rootKey ? { verify: (identity: string, presented: SignedCall) => openWith(rootKey, identity, presented) } : {}),
    requireIdentity: Boolean(root),
  };
}

/** A Worker has no `process`. Reading the global is what makes an absent one an empty env. */
function envOfProcess(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env ?? {};
}
