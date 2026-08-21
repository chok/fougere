import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  identityFromEnv,
  issueGrant,
  signEnvelope,
  verifyEnvelope,
  type FrondIdentity,
} from '../src/identity.js';

/** Exactly what `fougere keys` and `fougere grant` print. */
const packed = (pem: string) => Buffer.from(pem, 'utf8').toString('base64');

/** One ordinary call — the envelope binds it, so every signature names one. */
const CALL = { entity: 'post', op: 'list' };

/** What `fougere keys issue <name>` produces, and what the deployment injects. */
function issue(root: { privateKey: string }, name: string): FrondIdentity {
  const pair = generateKeyPair();
  return { privateKey: pair.privateKey, grant: issueGrant(root.privateKey, name, pair.publicKey) };
}

describe('caller identity', () => {
  const root = generateKeyPair();

  it('admits a frond the receiver has never seen', () => {
    // The receiver holds the root key alone — no list, no registration, no discovery.
    const blog = issue(root, 'blog');
    const verified = verifyEnvelope(signEnvelope(blog, { ...CALL, state: { user: { id: '1' } } }), root.publicKey, CALL);

    expect(verified.caller).toBe('blog');
    expect(verified.state).toEqual({ user: { id: '1' } });
  });

  it('refuses a state nobody signed — the hole this closes', () => {
    // What a reader used to post straight into `state` on a split receiver.
    expect(() => verifyEnvelope('not.a.token', root.publicKey, CALL)).toThrow();
  });

  it('refuses a frond signing under another frond name', () => {
    // Same system, real key, wrong name: the grant is the authority, the envelope repeats.
    const reader = issue(root, 'reader');
    const forged = signEnvelope(reader, { ...CALL, state: { user: { role: 'admin' } } });
    const header = JSON.parse(Buffer.from(forged.split('.')[0], 'base64url').toString());
    const payload = { iss: 'billing', state: {}, bound: {}, iat: Date.now(), exp: Date.now() + 60_000 };
    const tampered = [
      Buffer.from(JSON.stringify(header)).toString('base64url'),
      Buffer.from(JSON.stringify(payload)).toString('base64url'),
      forged.split('.')[2],
    ].join('.');

    expect(() => verifyEnvelope(tampered, root.publicKey, CALL)).toThrow(/signature/);
  });

  it('refuses a grant issued by another root', () => {
    // A whole parallel system: valid signatures throughout, wrong authority.
    const outsider = generateKeyPair();
    const impostor = issue(outsider, 'blog');

    expect(() => verifyEnvelope(signEnvelope(impostor, CALL), root.publicKey, CALL)).toThrow(/grant signature/);
  });

  it('refuses a tampered state', () => {
    const blog = issue(root, 'blog');
    const token = signEnvelope(blog, { ...CALL, state: { user: { role: 'reader' } } });
    const [header, , signature] = token.split('.');
    const escalated = Buffer.from(
      JSON.stringify({ iss: 'blog', state: { user: { role: 'admin' } }, bound: {}, iat: Date.now(), exp: Date.now() + 60_000 }),
    ).toString('base64url');

    expect(() => verifyEnvelope([header, escalated, signature].join('.'), root.publicKey, CALL)).toThrow(/signature/);
  });

  it('refuses an expired envelope', () => {
    const blog = issue(root, 'blog');
    const token = signEnvelope(blog, CALL);
    // Past the TTL and past the skew both — a signed call is not a session.
    const past = Date.now() - 10 * 60_000;
    const [header, , signature] = token.split('.');
    const stale = Buffer.from(JSON.stringify({ iss: 'blog', state: {}, bound: {}, iat: past, exp: past })).toString('base64url');

    expect(() => verifyEnvelope([header, stale, signature].join('.'), root.publicKey, CALL)).toThrow();
  });

  it('refuses a captured envelope replayed against another operation', () => {
    // What signing the state alone could not stop: the signature stays valid, the grant
    // stays valid, and `post.list` becomes `post.delete` for as long as the TTL lasts.
    const blog = issue(root, 'blog');
    const listing = signEnvelope(blog, { entity: 'post', op: 'list' });

    expect(() => verifyEnvelope(listing, root.publicKey, { entity: 'post', op: 'delete' }))
      .toThrow(/signed for a different call/);
  });

  it('refuses a captured envelope replayed with another body', () => {
    const blog = issue(root, 'blog');
    const envelope = signEnvelope(blog, { ...CALL, body: { title: 'hello' } });

    expect(() => verifyEnvelope(envelope, root.publicKey, { ...CALL, body: { title: 'defaced' } }))
      .toThrow(/signed for a different call/);
  });

  it('refuses it replayed against another row', () => {
    // `post.get id=1` must not become `post.get id=2`.
    const blog = issue(root, 'blog');
    const mine = signEnvelope(blog, { entity: 'post', op: 'get', params: { id: '1' } });

    expect(() => verifyEnvelope(mine, root.publicKey, { entity: 'post', op: 'get', params: { id: '2' } }))
      .toThrow(/signed for a different call/);
  });

  it('carries an anonymous call — no user, and it still passes', () => {
    // The correction that matters: a visitor listing posts, a seed, a health check.
    const blog = issue(root, 'blog');

    expect(verifyEnvelope(signEnvelope(blog, CALL), root.publicKey, CALL)).toEqual({ caller: 'blog', state: {} });
  });
});

describe('what the deployment injected', () => {
  const root = generateKeyPair();
  const frond = generateKeyPair();
  const grant = issueGrant(root.privateKey, 'blog', frond.publicKey);

  /** The seam most likely to be wrong: what the CLI PRINTS and what a boot READS. */
  it('reads back what `fougere keys` and `fougere grant` print', () => {
    const caller = identityFromEnv({ FOUGERE_KEY: packed(frond.privateKey), FOUGERE_GRANT: grant });
    const receiver = identityFromEnv({ FOUGERE_ROOT: packed(root.publicKey) });

    expect(receiver.verify!(caller.sign!({ ...CALL, state: { user: { id: 'alice' } } }), CALL)).toEqual({
      caller: 'blog',
      state: { user: { id: 'alice' } },
    });
  });

  it('takes a pasted PEM too — base64 is a convenience, not a decree', () => {
    const receiver = identityFromEnv({ FOUGERE_ROOT: root.publicKey });
    const caller = identityFromEnv({ FOUGERE_KEY: frond.privateKey, FOUGERE_GRANT: grant });

    expect(receiver.verify!(caller.sign!(CALL), CALL).caller).toBe('blog');
  });

  it('trusting a root IS asking to refuse — no second flag says so', () => {
    expect(identityFromEnv({ FOUGERE_ROOT: packed(root.publicKey) }).requireIdentity).toBe(true);
    expect(identityFromEnv({}).requireIdentity).toBe(false);
  });

  it('answers with neither half when nothing was injected', () => {
    // A laptop: no key to sign with, no root to trust. `serve()`'s loopback default
    // is what stands, and it is the whole of what stands.
    expect(identityFromEnv({})).toEqual({ requireIdentity: false });
  });

  it('a frond that only ANSWERS holds no key, and that is not an error', () => {
    const receiver = identityFromEnv({ FOUGERE_ROOT: packed(root.publicKey) });

    expect(receiver.sign).toBeUndefined();
    expect(receiver.verify).toBeTypeOf('function');
  });
});
