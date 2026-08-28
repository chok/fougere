import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import DevtoolsHandler from '../fronds/analysis/handlers/DevtoolsHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';

const fixture = join(import.meta.dirname, 'fixtures-devtools');
const devtools = () => new DevtoolsHandler(new ProjectScan());

describe('devtools', () => {
  it('reads every address the project declares, plus the local one', async () => {
    const view = await devtools().execute({ root: fixture });

    expect(view.sources.map((one) => `${one.frond ?? 'local'} ${one.url}`)).toEqual([
      'local http://127.0.0.1:3000',
      'blog http://127.0.0.1:4991',
      'shop http://127.0.0.1:4992',
    ]);
  });

  it('gives an address that did not answer a reason rather than dropping it', async () => {
    const view = await devtools().execute({ root: fixture });

    // Three facts a reader needs to tell apart: not started, no package, and quiet.
    expect(view.sources.every((one) => one.refusal?.includes('unreachable'))).toBe(true);
    expect(view.calls).toEqual([]);
  });

  it('reads one address alone when it is named, without touching the project', async () => {
    const view = await devtools().execute({ url: 'http://127.0.0.1:4993/' });

    expect(view.sources).toHaveLength(1);
    expect(view.sources[0]).toMatchObject({ url: 'http://127.0.0.1:4993' });
  });
});
