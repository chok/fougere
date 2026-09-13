import { join } from 'node:path';
import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import DevtoolsHandler from '../fronds/analysis/handlers/DevtoolsHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';

const fixture = join(import.meta.dirname, 'fixtures-devtools');
const devtools = () => new DevtoolsHandler(new ProjectScan());

/** A port this test has owned and released, so nothing can be listening on it. */
async function nobodys(): Promise<string> {
  const server = createServer();
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((closed) => server.close(() => closed()));

  return `http://127.0.0.1:${port}`;
}

let here: string;
const was = process.env.FOUGERE_URL;

/**
 * The local address is a CONVENTION (`:3000`) and the host owns the port, so a test that
 * asserts against it asserts about the machine: a Ruby app on 3000 answered these calls a
 * 404, which is a different refusal and a true one. `FOUGERE_URL` is how a host says where
 * its app actually is, and here it says a port nothing can answer on.
 */
beforeAll(async () => {
  here = await nobodys();
  process.env.FOUGERE_URL = here;
});

afterAll(() => {
  if (was === undefined) delete process.env.FOUGERE_URL;
  else process.env.FOUGERE_URL = was;
});

describe('devtools', () => {
  it('reads every address the project declares, plus the local one', async () => {
    const view = await devtools().execute({ root: fixture });

    expect(view.sources.map((one) => `${one.frond ?? 'local'} ${one.url}`)).toEqual([
      `local ${here}`,
      'blog http://127.0.0.1:4991',
      'shop http://127.0.0.1:4992',
    ]);
  });

  it('gives an address that did not answer a reason rather than dropping it', async () => {
    const view = await devtools().execute({ root: fixture });

    // Four facts a reader needs to tell apart: not started, no package, quiet — and a
    // stranger, which is what an address answering something else says for itself.
    expect(view.sources.every((one) => one.refusal?.includes('unreachable'))).toBe(true);
    expect(view.calls).toEqual([]);
  });

  it('says so when an address answers but serves no call log', async () => {
    const stranger = createServer((_request, response) => { response.writeHead(404).end(); });
    await new Promise<void>((ready) => stranger.listen(0, '127.0.0.1', ready));
    const address = stranger.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const view = await devtools().execute({ url: `http://127.0.0.1:${port}` });

      expect(view.sources[0].refusal).toContain('not a Fougere receiver');
    } finally {
      await new Promise<void>((closed) => stranger.close(() => closed()));
    }
  });

  it('reads one address alone when it is named, without touching the project', async () => {
    const view = await devtools().execute({ url: 'http://127.0.0.1:4993/' });

    expect(view.sources).toHaveLength(1);
    expect(view.sources[0]).toMatchObject({ url: 'http://127.0.0.1:4993' });
  });
});
