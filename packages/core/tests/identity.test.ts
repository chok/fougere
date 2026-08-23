import { describe, it, expect } from 'vitest';
import {
  identityFromEnv,
  signEnvelope,
  verifyEnvelope,
  type FrondIdentity,
} from '../src/identity.js';
// Making keys is a deployment gesture and lives on the Node entry — the test issues real
// ones rather than fixtures, because a fixture key proves nothing about the parsing.
import { generateKeyPair, issueGrant } from '../src/identity-keys.js';

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

  it('admits a frond the receiver has never seen', async () => {
    // The receiver holds the root key alone — no list, no registration, no discovery.
    const blog = issue(root, 'blog');
    const verified = await verifyEnvelope(await signEnvelope(blog, { ...CALL, state: { user: { id: '1' } } }), root.publicKey, CALL);

    expect(verified.caller).toBe('blog');
    expect(verified.state).toEqual({ user: { id: '1' } });
  });

  it('refuses a state nobody signed — the hole this closes', async () => {
    // What a reader used to post straight into `state` on a split receiver.
    await expect(verifyEnvelope('not.a.token', root.publicKey, CALL)).rejects.toThrow();
  });

  it('refuses a frond signing under another frond name', async () => {
    // Same system, real key, wrong name: the grant is the authority, the envelope repeats.
    const reader = issue(root, 'reader');
    const forged = await signEnvelope(reader, { ...CALL, state: { user: { role: 'admin' } } });
    const header = JSON.parse(Buffer.from(forged.split('.')[0], 'base64url').toString());
    const payload = { iss: 'billing', state: {}, bound: {}, iat: Date.now(), exp: Date.now() + 60_000 };
    const tampered = [
      Buffer.from(JSON.stringify(header)).toString('base64url'),
      Buffer.from(JSON.stringify(payload)).toString('base64url'),
      forged.split('.')[2],
    ].join('.');

    await expect(verifyEnvelope(tampered, root.publicKey, CALL)).rejects.toThrow(/signature/);
  });

  it('refuses a grant issued by another root', async () => {
    // A whole parallel system: valid signatures throughout, wrong authority.
    const outsider = generateKeyPair();
    const impostor = issue(outsider, 'blog');

    await expect(verifyEnvelope(await signEnvelope(impostor, CALL), root.publicKey, CALL)).rejects.toThrow(/grant signature/);
  });

  it('refuses a tampered state', async () => {
    const blog = issue(root, 'blog');
    const token = await signEnvelope(blog, { ...CALL, state: { user: { role: 'reader' } } });
    const [header, , signature] = token.split('.');
    const escalated = Buffer.from(
      JSON.stringify({ iss: 'blog', state: { user: { role: 'admin' } }, bound: {}, iat: Date.now(), exp: Date.now() + 60_000 }),
    ).toString('base64url');

    await expect(verifyEnvelope([header, escalated, signature].join('.'), root.publicKey, CALL)).rejects.toThrow(/signature/);
  });

  it('refuses an expired envelope', async () => {
    const blog = issue(root, 'blog');
    const token = await signEnvelope(blog, CALL);
    // Past the TTL and past the skew both — a signed call is not a session.
    const past = Date.now() - 10 * 60_000;
    const [header, , signature] = token.split('.');
    const stale = Buffer.from(JSON.stringify({ iss: 'blog', state: {}, bound: {}, iat: past, exp: past })).toString('base64url');

    await expect(verifyEnvelope([header, stale, signature].join('.'), root.publicKey, CALL)).rejects.toThrow();
  });

  it('refuses a captured envelope replayed against another operation', async () => {
    // What signing the state alone could not stop: the signature stays valid, the grant
    // stays valid, and `post.list` becomes `post.delete` for as long as the TTL lasts.
    const blog = issue(root, 'blog');
    const listing = await signEnvelope(blog, { entity: 'post', op: 'list' });

    await expect(verifyEnvelope(listing, root.publicKey, { entity: 'post', op: 'delete' })).rejects.toThrow(/signed for a different call/);
  });

  it('refuses a captured envelope replayed with another body', async () => {
    const blog = issue(root, 'blog');
    const envelope = await signEnvelope(blog, { ...CALL, body: { title: 'hello' } });

    await expect(verifyEnvelope(envelope, root.publicKey, { ...CALL, body: { title: 'defaced' } })).rejects.toThrow(/signed for a different call/);
  });

  it('refuses it replayed against another row', async () => {
    // `post.get id=1` must not become `post.get id=2`.
    const blog = issue(root, 'blog');
    const mine = await signEnvelope(blog, { entity: 'post', op: 'get', params: { id: '1' } });

    await expect(verifyEnvelope(mine, root.publicKey, { entity: 'post', op: 'get', params: { id: '2' } })).rejects.toThrow(/signed for a different call/);
  });

  it('carries an anonymous call — no user, and it still passes', async () => {
    // The correction that matters: a visitor listing posts, a seed, a health check.
    const blog = issue(root, 'blog');

    expect(await verifyEnvelope(await signEnvelope(blog, CALL), root.publicKey, CALL)).toEqual({ caller: 'blog', state: {} });
  });
});

describe('what the deployment injected', () => {
  const root = generateKeyPair();
  const frond = generateKeyPair();
  const grant = issueGrant(root.privateKey, 'blog', frond.publicKey);

  /** The seam most likely to be wrong: what the CLI PRINTS and what a boot READS. */
  it('reads back what `fougere keys` and `fougere grant` print', async () => {
    const caller = await identityFromEnv({ FOUGERE_KEY: packed(frond.privateKey), FOUGERE_GRANT: grant });
    const receiver = await identityFromEnv({ FOUGERE_ROOT: packed(root.publicKey) });

    const envelope = await caller.sign!({ ...CALL, state: { user: { id: 'alice' } } });

    expect(await receiver.verify!(envelope, CALL)).toEqual({
      caller: 'blog',
      state: { user: { id: 'alice' } },
    });
  });

  it('takes a pasted PEM too — base64 is a convenience, not a decree', async () => {
    const receiver = await identityFromEnv({ FOUGERE_ROOT: root.publicKey });
    const caller = await identityFromEnv({ FOUGERE_KEY: frond.privateKey, FOUGERE_GRANT: grant });

    expect((await receiver.verify!(await caller.sign!(CALL), CALL)).caller).toBe('blog');
  });

  it('trusting a root IS asking to refuse — no second flag says so', async () => {
    expect((await identityFromEnv({ FOUGERE_ROOT: packed(root.publicKey) })).requireIdentity).toBe(true);
    expect((await identityFromEnv({})).requireIdentity).toBe(false);
  });

  it('answers with neither half when nothing was injected', async () => {
    // A laptop: no key to sign with, no root to trust. `serve()`'s loopback default
    // is what stands, and it is the whole of what stands.
    expect(await identityFromEnv({})).toEqual({ requireIdentity: false });
  });

  it('a frond that only ANSWERS holds no key, and that is not an error', async () => {
    const receiver = await identityFromEnv({ FOUGERE_ROOT: packed(root.publicKey) });

    expect(receiver.sign).toBeUndefined();
    expect(receiver.verify).toBeTypeOf('function');
  });
});
