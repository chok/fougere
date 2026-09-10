/**
 * What an extension BRINGS instruments the app; it is not what the app serves.
 *
 * `Extension.fronds` is how an optional package accepts a fact — a subscription is a
 * signature, and `up` receives an app that already exists. Such a frond is in EVERY process
 * that installed the extension, so anything reading the card as "who hosts what" sees the
 * same door on all of them.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, frond, identityCardOf } from '../src/index.js';
import { entity, primary, text } from '@fougere/schema';

class Product extends entity({ id: primary(), title: text() }) {}

class ProductHandler {
  async list(): Promise<Product[]> { return []; }
}

/** The shape every destination in the tree has: a handler, and nothing else. */
class ExportHandler {
  async record(): Promise<void> {}
}

const instrumenting = {
  name: 'exporting',
  fronds: [frond('exporting', {
    handlers: [{
      ctor: ExportHandler,
      deps: [],
      operations: {
        record: {
          binding: [{ name: 'line', optional: false, source: { kind: 'fact' as const, factName: 'logLine' } }],
        },
      },
    }],
  })],
};

const built = () => createApp({
  fronds: [frond('catalog', {
    entities: [Product],
    handlers: [{ ctor: ProductHandler, deps: [], operations: { list: { binding: [] } } }],
  })],
  extensions: [instrumenting],
  createContainer,
});

describe('a frond an extension brought', () => {
  it('is installed, and answers where it is', async () => {
    await using app = await built();

    expect(app.fronds.map((one) => one.name)).toContain('exporting');
    expect(app.fronds.find((one) => one.name === 'exporting')?.brought).toBe(true);
  });

  it('is left out of the identity card', async () => {
    await using app = await built();

    // Two processes installing one extension both answered `export` on `rpc.discover`, and
    // the remote router refused: `Two remotes serve 'export'`. Measured on
    // `demos/observability`, where the third process could then reach neither of them.
    const card = identityCardOf(app);
    expect(card.fronds.map((one) => one.name)).toEqual(['catalog']);
  });

  it('leaves what the app does serve untouched', async () => {
    await using app = await built();

    const doors = identityCardOf(app).fronds.flatMap((one) => one.doors.map((door) => door.name));
    expect(doors).toEqual(['product']);
  });
});
