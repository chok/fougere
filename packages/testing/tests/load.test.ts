/**
 * The scenario a scan can write, and the part it cannot.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testApp, loadScript } from '../src/index.js';
import { reachableOps } from '../src/load.js';

const root = join(import.meta.dirname, 'fixtures');

describe('the operations a load run reaches', () => {
  it('are every one the app answers, not the ones an author remembered', async () => {
    await using app = await testApp({ root });

    const methods = reachableOps(app).map((op) => op.method);

    expect(methods).toContain('article.create');
    expect(methods).toContain('article.list');
    expect(methods).toContain('article.delete');
    expect(methods).toContain('order.pay');
  });

  it('carry a body only where the contract states an input', async () => {
    await using app = await testApp({ root });

    const ops = new Map(reachableOps(app).map((op) => [op.method, op.input]));

    expect(ops.get('article.create')).toMatchObject({ title: expect.any(String) });
    expect(ops.get('article.delete')).toBeUndefined();
  });
});

describe('the generated script', () => {
  it('is valid JavaScript that k6 can parse', async () => {
    await using app = await testApp({ root });

    const script = loadScript(app, { facade: 'http://localhost:4200/_fougere/call' });

    // Parsed by node rather than pattern-matched: a template that produces a syntax
    // error is the one failure a `toContain` would sail straight past. `.mjs` because
    // the script is a module — `new Function` does not know `import` or `export`.
    const file = join(mkdtempSync(join(tmpdir(), 'fougere-load-')), 'load.mjs');
    writeFileSync(file, script);

    expect(() => execFileSync(process.execPath, ['--check', file])).not.toThrow();
    expect(script).toContain('http://localhost:4200/_fougere/call');
  });

  it('calls what k6 exports, and sends the input where a receiver reads it', async () => {
    await using app = await testApp({ root });

    const script = loadScript(app);

    // Syntax passes on a call to a function nobody defined: a rename once turned k6's
    // `check` into `validate`, and every generated scenario died at its first iteration.
    expect(script).toMatch(/import \{ check \} from 'k6';[\s\S]*\bcheck\(response/);
    expect(script).not.toMatch(/\bvalidate\(/);
    expect(script).toMatch(/input: op\.input/);
  });

  it('carries the envelope `frameCall` states, not a hand-copied one', async () => {
    await using app = await testApp({ root });

    const script = loadScript(app);

    // `demos/observability/load.js` spells `jsonrpc: '2.0'` by hand and will go on
    // claiming to be JSON-RPC the day the format moves. This one asked.
    expect(script).toContain('"jsonrpc":"2.0"');
  });

  it('leaves the weights, the stages and the budget to be written', async () => {
    await using app = await testApp({ root });

    const script = loadScript(app);

    expect(script).toMatch(/Yours: a flat rate/);
    expect(script).toMatch(/Yours: how long an op may take here/);
    expect(script).toContain('const BUDGET = { base: 300, perHop: 200 };');
  });

  /**
   * One threshold for every operation held an op that never leaves the process to the same
   * figure as one that crosses two. The budget is two numbers now — what an op costs here, and
   * what a process boundary adds — and which applies is read from the code.
   */
  it('holds each op to a budget its own hops decide', async () => {
    await using app = await testApp({ root });

    const script = loadScript(app);

    expect(script).toContain('http_req_duration{op:${op.method}}');
    expect(script).toContain('BUDGET.base + op.hops * BUDGET.perHop');
    expect(script).not.toContain("http_req_duration: ['p(95)<500']");
  });

  it('carries the hop count of every op it lists', async () => {
    await using app = await testApp({ root });

    for (const op of reachableOps(app)) expect(op.hops).toBe(0);
  });
});
