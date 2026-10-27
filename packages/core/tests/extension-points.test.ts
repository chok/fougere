/**
 * What answers each extension point in a booted app — read off what was installed, never guessed.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, frond, Present, type Call, type Dispatcher } from '../src/index.js';
import { op } from './contract.js';

class Post extends entity({ id: primary(), title: text() }) {}

class Payment {}
class StripePayment extends Payment {}

class Audit implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher) {}
  async dispatch(call: Call) { return this.inner.dispatch(call); }
}

class PostPresenter extends Present<Post> {
  async shout(rows: { title: string }[]) { return rows.map((row) => row.title.toUpperCase()); }
}

class PostHandler {
  constructor(readonly payment: Payment) {}
  async list() { return [{ id: 'p1', title: 'fern' }]; }
}

describe('app.extensionPoints()', () => {
  it('says what answers each point: a port, a link around the calls, a step, a registry and the extensions', async () => {
    await using app = await createApp({
      createContainer,
      storageFactory: () => ({}) as never,
      fronds: [frond('blog', {
        entities: [Post],
        providers: [Payment, StripePayment, { ctor: Audit, deps: ['Dispatcher'], implements: ['Dispatcher'] }],
        presenters: [{ ctor: PostPresenter, presents: Post }],
        handlers: [{ ctor: PostHandler, deps: ['Payment'], operations: { list: op({ cardinality: 'many', output: Post }) } }],
      })],
    });
    const points = app.extensionPoints();

    expect(points).toContainEqual({ point: 'Payment', by: 'type', frond: 'blog', answers: ['StripePayment'] });
    expect(points).toContainEqual({ point: 'Dispatcher', by: 'type', frond: 'blog', answers: ['Audit'] });
    expect(points).toContainEqual({ point: 'answer step', by: 'name', frond: 'blog', subject: 'post', answers: ['presenters'] });
    expect(points).toContainEqual(expect.objectContaining({ point: 'binding source', by: 'name', answers: ['fact', 'pipe', 'collector', 'state'] }));
    expect(points).toContainEqual({ point: 'extension', by: 'name', answers: ['schema', 'values', 'seeds', 'presenters'] });
  });
});
