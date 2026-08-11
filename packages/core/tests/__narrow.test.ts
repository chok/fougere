import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner } from '../src/index.js';

describe('demo', () => {
  it('runs', async () => {
    const app = await createApp({ root: join(import.meta.dirname, 'fixtures-narrow-signature'), createContainer });
    const run = createLocalRunner(app);
    for (const op of ['doublePlain', 'doubleCents']) {
      const out = await run({ entity: 'invoice', op },
        { params: { amount: '1500' }, query: {}, body: { amount: 1500 }, state: {} });
      process.stderr.write(`${op.padEnd(12)} amount * 2  =  ${JSON.stringify(out)}\n`);
    }
    await app.dispose();
    expect(true).toBe(true);
  });
});
