/**
 * `reads:` is what makes a cross-source reader exist in a frond — and what bounds it.
 *
 * Nothing about the reader itself is here: core must not name a storage package, so it
 * takes a factory exactly as it takes `ormFactory`, and never learns what backs it.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { createApp } from '../src/index.js';

const schemaDist = join(import.meta.dirname, '..', '..', 'schema', 'dist', 'index.js');

function writeApp(reads: string | undefined): string {
  const root = mkdtempSync(join(tmpdir(), 'fougere-reads-'));
  const frond = join(root, 'fronds', 'shop');
  mkdirSync(join(frond, 'entities'), { recursive: true });
  mkdirSync(join(frond, 'services'), { recursive: true });

  for (const name of ['Order', 'Line']) {
    writeFileSync(join(frond, 'entities', `${name}.js`), `
import { entity, primary, text } from ${JSON.stringify(schemaDist)};
export default class ${name} extends entity({ id: primary(), label: text() }) {}
`);
  }
  writeFileSync(join(frond, 'services', 'Report.js'), `
export default class Report {
  constructor(sources) { this.sources = sources; }
}
`);
  if (reads !== undefined) {
    writeFileSync(join(frond, 'frond.config.js'), `export default { reads: ${reads} };`);
  }
  return root;
}

describe('a frond that declares what it reads', () => {
  let root: string;
  beforeAll(() => { root = writeApp(`['Order', 'Line']`); });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it('is handed a reader built over the CLASSES it named', async () => {
    const built: unknown[][] = [];
    const sourcesFactory = vi.fn(async (reads: unknown[]) => { built.push(reads); return { tag: 'reader' }; });
    const app = await createApp({ root, createContainer, sourcesFactory });

    expect(sourcesFactory).toHaveBeenCalledTimes(1);
    // Classes, not names: a name would make the reader resolve the schema a second time.
    expect(built[0]).toHaveLength(2);
    expect(built[0]!.map((c: any) => c.name).sort()).toEqual(['Line', 'Order']);
    await app.dispose();
  });

  it('lives in the FROND, not at the root — one scope, one environment', async () => {
    // Like an entity's ORM: `resolve` reads the root container and finds none there.
    // It has to be per frond, because `reads:` is per frond and the list IS what got
    // attached — a root-wide reader would be one frond's scope handed to every other.
    const app = await createApp({ root, createContainer, sourcesFactory: async () => ({ tag: 'reader' }) });
    expect(() => app.resolve('Sources')).toThrow();
    await app.dispose();
  });
});

describe('a frond that declares none', () => {
  let root: string;
  beforeAll(() => { root = writeApp(undefined); });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it('gets no reader, and nothing is attached on its behalf', async () => {
    const sourcesFactory = vi.fn(async () => ({ tag: 'reader' }));
    const app = await createApp({ root, createContainer, sourcesFactory });

    expect(sourcesFactory).not.toHaveBeenCalled();
    expect(() => app.resolve('Sources')).toThrow();
    await app.dispose();
  });
});

describe('a boot that ignores the clause', () => {
  let root: string;
  beforeAll(() => { root = writeApp(`['Order', 'Line']`); });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it('says so — otherwise the handler dies later on a message naming neither', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // No `sourcesFactory`: legitimate — a boot that hosts no reader is ordinary, and
    // refusing it would make the clause a hard dependency on a storage package.
    const app = await createApp({ root, createContainer });

    const said = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(said).toMatch(/\[reads\] Order, Line/);
    expect(said).toMatch(/sourcesFactory/);
    warn.mockRestore();
    await app.dispose();
  });
});

describe('a name `reads:` gets wrong', () => {
  let root: string;
  beforeAll(() => { root = writeApp(`['Order', 'Ghost']`); });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it('is reported and the rest still opens — a typo is not worth refusing the boot', async () => {
    const built: unknown[][] = [];
    const app = await createApp({
      root, createContainer,
      sourcesFactory: async (reads: unknown[]) => { built.push(reads); return {}; },
    });

    expect(built[0]!.map((c: any) => c.name)).toEqual(['Order']);
    await app.dispose();
  });
});

describe('an entity of ANOTHER frond', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'fougere-reads-cross-'));
    for (const [frond, entity] of [['shop', 'Order'], ['catalog', 'Book']]) {
      const dir = join(root, 'fronds', frond, 'entities');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${entity}.js`), `
import { entity, primary, text } from ${JSON.stringify(schemaDist)};
export default class ${entity} extends entity({ id: primary(), label: text() }) {}
`);
    }
    writeFileSync(join(root, 'fronds', 'shop', 'frond.config.js'),
      `export default { reads: ['Order', 'Book'] };`);
  });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it('may be named — a cross-source query joins fronds by definition', async () => {
    const built: unknown[][] = [];
    const app = await createApp({
      root, createContainer,
      sourcesFactory: async (reads: unknown[]) => { built.push(reads); return {}; },
    });
    expect(built[0]!.map((c: any) => c.name).sort()).toEqual(['Book', 'Order']);
    await app.dispose();
  });
});
