/**
 * A facade takes the handler's own arguments, and a door sends a call.
 *
 * Code calling a facade already holds the values: nothing is collected for it and nothing is
 * presented. A door holds a request — `params`, `query`, `input` — and the binding plan reads
 * it, collector and presenter included. Both run the same judge on the input.
 */
import stock from './fixtures-facade-arguments/fronds.js';
import User from './fixtures-facade-arguments/fronds/stock/entities/User.js';
import type ArticleHandler from './fixtures-facade-arguments/fronds/stock/handlers/ArticleHandler.js';
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { json } from '@fougere/schema';
import { createApp, createAppRunner, createLocalRunner, ErrorCode, FougereError } from '../src/index.js';
import type { App, Extension, Facade, Transport } from '../src/index.js';

/** What an auth extension would declare: the user a door's middleware puts in `state`. */
const session: Extension = { name: 'session', state: { user: json(User) } };

const reader = { id: 'u1', email: 'reader@fern.dev' };
const admin = { id: 'u2', email: 'admin@fern.dev' };

/** Everything crosses as JSON, both directions — what this wire cannot carry, HTTP cannot either. */
const asWire = (runner: Transport): Transport => async (call, invocation) => {
  const sent = JSON.parse(JSON.stringify({ call, invocation }));
  try {
    return JSON.parse(JSON.stringify(await runner(sent.call, { ...sent.invocation, crossed: true })));
  } catch (err) {
    if (err instanceof FougereError) throw FougereError.fromJSON(JSON.parse(JSON.stringify(err.toJSON())));
    throw err;
  }
};

const here = (): Promise<App> => createApp({ fronds: [stock], createContainer, extensions: [session] });

async function elsewhere(): Promise<{ consumer: App; host: App }> {
  const host = await here();
  const consumer = await createApp({
    fronds: [],
    createContainer,
    extensions: [session],
    remotes: { stock: 'mem://stock' },
    remoteTransport: () => asWire(createLocalRunner(host)),
  });

  return { consumer, host };
}

describe.each([
  ['in this process', async () => { const app = await here(); return { app, done: () => app.dispose() }; }],
  ['in another process', async () => {
    const { consumer, host } = await elsewhere();
    return { app: consumer, done: async () => { await consumer.dispose(); await host.dispose(); } };
  }],
])('a facade, %s', (_, boot) => {
  it('binds the arguments as written, and judges the input', async () => {
    const { app, done } = await boot();
    const articles = app.resolve<Facade<ArticleHandler>>('articleHandler');

    expect(await articles.restock('a1', { quantity: 3 }, admin))
      .toEqual({ id: 'a1', sku: 'fern', quantity: 3, by: 'admin@fern.dev' });
    await expect(articles.restock('a1', { quantity: 0 }))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    await done();
  });

  it('collects nothing: a user left out stays out', async () => {
    const { app, done } = await boot();
    const articles = app.resolve<Facade<ArticleHandler>>('articleHandler');

    expect(await articles.restock('a1', { quantity: 1 })).toMatchObject({ by: null });

    await done();
  });

  it('presents nothing — the computed field is a door\'s', async () => {
    const { app, done } = await boot();
    const articles = app.resolve<Facade<ArticleHandler>>('articleHandler');

    expect(await articles.restock('a1', { quantity: 2 })).not.toHaveProperty('label');

    await done();
  });

  it('hands a fact over as an argument, judged like an input', async () => {
    const { app, done } = await boot();
    const articles = app.resolve<Facade<ArticleHandler>>('articleHandler');

    expect(await articles.record({ quantity: 4 })).toBe(4);
    await expect(articles.record({ quantity: 0 }))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    await done();
  });

  it('a door collects and presents', async () => {
    const { app, done } = await boot();

    const answered = await createAppRunner(app)(
      { address: 'article', op: 'restock' },
      { params: { id: 'a1' }, query: {}, input: { quantity: 2 }, state: { user: reader } },
    );
    expect(answered).toEqual({ id: 'a1', sku: 'fern', quantity: 2, by: 'reader@fern.dev', label: 'fern × 2' });

    await done();
  });
});

it('the type is the handler\'s signature', async () => {
  await using app = await here();
  const articles = app.resolve<Facade<ArticleHandler>>('articleHandler');

  // @ts-expect-error — an invocation is what a door sends, not what code writes
  await expect(articles.restock({ params: { id: 'a1' }, query: {}, input: { quantity: 1 }, state: {} })).rejects.toThrow();
  const restocked: { by: string | null } = await articles.restock('a1', { quantity: 1 });
  expect(restocked.by).toBeNull();
});
