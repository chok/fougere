/** Who is calling — the proof, not the claim. */
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

/** The payload, once the signature holds. */
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

/** Sign one call, whole. */
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

/** Establish the caller, or throw. */
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
  /** Signs an outgoing call, whole. */
  sign?: (call: SignedCall) => Promise<string>;
  /** Establishes an incoming caller, against the call that actually arrived. */
  verify?: (identity: string, presented: SignedCall) => Promise<VerifiedCall>;
  /** Refuse an unsigned call. True exactly when a root is trusted. */
  requireIdentity: boolean;
}

/** A PEM, however the deployment chose to carry it. */
function pemOf(value: string): string {
  return value.trimStart().startsWith('-----') ? value : textOf(unb64(value));
}

/** What the deployment injected, read once at boot. */
export async function identityFromEnv(env: Record<string, string | undefined> = envOfProcess()): Promise<CallIdentity> {
  const root = env.FOUGERE_ROOT_KEY ? pemOf(env.FOUGERE_ROOT_KEY) : undefined;
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
