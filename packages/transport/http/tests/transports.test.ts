/**
 * Importing the package is what makes `http://`, `https://` and `binding://` addresses answer.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writtenStatement } from '@fougere/compiler';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, Transports } from '@fougere/core';
import { Invocation } from '@fougere/core/contract';
import { serve } from '../src/index.js';
import { bindingOver } from '../src/transports.js';
import { createStorageFactory, PRODUCTS } from './fixtures/data.js';

const answered = { jsonrpc: '2.0', id: 1, result: ['p1'] };

const reached: string[] = [];

const worker = bindingOver(async () => ({
  CATALOG: {
    fetch: async (request: Request) => {
      reached.push(request.url);

      return Response.json(answered);
    },
  },
}));

describe('the schemes this package answers', () => {
  it('registers http, https and binding', () => {
    expect(Transports.names).toEqual(expect.arrayContaining(['http', 'https', 'binding']));
  });

  it('carries a call to an http:// address with nothing but the `remotes:` line', async () => {
    await using catalog = await createApp({
      ...(await writtenStatement(join(import.meta.dirname, 'fixtures'))),
      createContainer,
      storageFactory: createStorageFactory(),
    });
    const receiver = await serve(createLocalRunner(catalog), { port: 0 });
    try {
      await using consumer = await createApp({
        ...(await writtenStatement('/tmp/fougere-transports-consumer')),
        createContainer,
        remotes: { catalog: `http://127.0.0.1:${receiver.port}` },
      });
      const facade = consumer.resolve<{ list: () => Promise<unknown> }>('Facade<ProductHandler>');

      expect(await facade.list()).toEqual({ items: PRODUCTS });
    } finally {
      await receiver.close();
    }
  });

  it('carries a binding:// call through the service binding of that name', async () => {
    const transport = worker.open(new URL('binding://CATALOG'), { requireIdentity: false });

    expect(await transport({ address: 'product', op: 'list' }, Invocation.empty)).toEqual(['p1']);
    expect(reached).toEqual(['https://catalog/_fougere/call']);
  });

  it('answers unreachable for a binding the Worker does not have, and names it underneath', async () => {
    const transport = worker.open(new URL('binding://SEARCH'), { requireIdentity: false });
    const refused = await transport({ address: 'post', op: 'list' }, Invocation.empty).catch((error: Error) => error);

    expect((refused as Error).message).toMatch(/post\.list: the process serving it is unreachable/);
    expect(((refused as Error).cause as Error).message).toMatch(/no service binding named 'SEARCH'/);
  });
});
