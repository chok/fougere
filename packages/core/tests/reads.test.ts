/**
 * `reads:` is what makes a cross-source reader exist in a frond — and what bounds it.
 *
 * Nothing about the reader itself is here: core must not name a storage package, so it
 * takes a factory exactly as it takes `storageFactory`, and never learns what backs it.
 */
import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { createContainer } from '@fougere/container';
import { createApp, frond, type FrondDescriptor } from '../src/index.js';

class Order extends entity({ id: primary(), label: text() }) {}
class Line extends entity({ id: primary(), label: text() }) {}
class Book extends entity({ id: primary(), label: text() }) {}

class Report {
  constructor(public sources: unknown) {}
}

/** `reads:` is a key `frond.config.ts` states; `frond()` takes none, so the descriptor carries it. */
const shop = (reads?: string[]): FrondDescriptor[] => [{
  ...frond('shop', { entities: [Order, Line], providers: [{ ctor: Report, deps: ['Reads'] }] }),
  ...(reads ? { reads } : {}),
}];

describe('a frond that declares what it reads', () => {
  const root = shop(['Order', 'Line']);

  it('is handed a reader built over the CLASSES it named', async () => {
    const built: unknown[][] = [];
    const sourcesFactory = vi.fn(async (reads: unknown[]) => { built.push(reads); return { tag: 'reader' }; });
    const app = await createApp({ fronds: root, createContainer, sourcesFactory });

    expect(sourcesFactory).toHaveBeenCalledTimes(1);
    // Classes, not names: a name would make the reader resolve the schema a second time.
    expect(built[0]).toHaveLength(2);
    expect(built[0]!.map((c: any) => c.name).sort()).toEqual(['Line', 'Order']);
    await app.dispose();
  });

  it('lives in the FROND, not at the root — one scope, one environment', async () => {
    // Like an entity's storage: `resolve` reads the root container and finds none there.
    // It has to be per frond, because `reads:` is per frond and the list IS what got
    // attached — a root-wide reader would be one frond's scope handed to every other.
    const app = await createApp({ fronds: root, createContainer, sourcesFactory: async () => ({ tag: 'reader' }) });
    expect(() => app.resolve('Reads')).toThrow();
    await app.dispose();
  });
});

describe('a frond that declares none', () => {
  const root = shop();

  it('gets no reader, and nothing is attached on its behalf', async () => {
    const sourcesFactory = vi.fn(async () => ({ tag: 'reader' }));
    const app = await createApp({ fronds: root, createContainer, sourcesFactory });

    expect(sourcesFactory).not.toHaveBeenCalled();
    expect(() => app.resolve('Reads')).toThrow();
    await app.dispose();
  });
});

describe('a boot that ignores the clause', () => {
  const root = shop(['Order', 'Line']);

  it('says so — otherwise the handler dies later on a message naming neither', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // No `sourcesFactory`: legitimate — a boot that hosts no reader is ordinary, and
    // refusing it would make the clause a hard dependency on a storage package.
    const app = await createApp({ fronds: root, createContainer });

    const said = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(said).toMatch(/\[reads\] Order, Line/);
    expect(said).toMatch(/sourcesFactory/);
    warn.mockRestore();
    await app.dispose();
  });
});

describe('a name `reads:` gets wrong', () => {
  const root = shop(['Order', 'Ghost']);

  it('is reported and the rest still opens — a typo is not worth refusing the boot', async () => {
    const built: unknown[][] = [];
    const app = await createApp({
      fronds: root, createContainer,
      sourcesFactory: async (reads: unknown[]) => { built.push(reads); return {}; },
    });

    expect(built[0]!.map((c: any) => c.name)).toEqual(['Order']);
    await app.dispose();
  });
});

describe('an entity of ANOTHER frond', () => {
  const root: FrondDescriptor[] = [
    { ...frond('shop', { entities: [Order] }), reads: ['Order', 'Book'] },
    frond('catalog', { entities: [Book] }),
  ];

  it('may be named — a cross-source query joins fronds by definition', async () => {
    const built: unknown[][] = [];
    const app = await createApp({
      fronds: root, createContainer,
      sourcesFactory: async (reads: unknown[]) => { built.push(reads); return {}; },
    });
    expect(built[0]!.map((c: any) => c.name).sort()).toEqual(['Book', 'Order']);
    await app.dispose();
  });
});
