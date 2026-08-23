import { scanProject } from '../src/node.js';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-contract-boundary');

describe('an operation contract is one boundary on every door', () => {
  it('hands decoded input to the handler and projects its declared output once', async () => {
    const app = await createApp({ scan: await scanProject(root), createContainer });
    const run = createLocalRunner(app);
    const when = '2026-08-05T12:00:00.000Z';

    const result = await run(
      { entity: 'event', op: 'schedule' },
      { params: {}, query: {}, body: { when }, state: {} },
    );

    expect(result).toEqual({ when, decoded: true });
    await app.dispose();
  });

  it('names an anonymous derived entity from its declaration file', async () => {
    const app = await createApp({ scan: await scanProject(root), createContainer });
    expect(app.fronds[0].entities.map((entity) => entity.name)).toContain('guest');
    await app.dispose();
  });
});
