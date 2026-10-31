/**
 * Every claim a tutorial step makes, checked against the step itself: the line each letter points
 * at exists, the request of "try it" answers what the page prints, the "what if" refuses as said,
 * and the "0 line changed" of steps 4 and 6 is an equality of files, not a sentence.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { testApp } from '@fougere/testing';
import { bootApp } from '@fougere/defaults';
import { answer } from '@fougere/app/answer';
import { loadConfig, remotesOf } from '@fougere/core/node';
import { identityCardOf, type App } from '@fougere/core';

const STEPS = join(import.meta.dirname, '..', 'steps');
const names = readdirSync(STEPS).filter((name) => !name.startsWith('.')).sort();

interface Step {
  grows: { label: string; from: { file: string; line: string } }[];
  try?: { request?: { method: string; path: string; body?: unknown; twice?: boolean }; status?: number; contains?: string; log?: string };
}

const stepOf = (name: string): Step => JSON.parse(readFileSync(join(STEPS, name, 'STEP.json'), 'utf8'));

const send = async (app: App, method: string, path: string, body?: unknown) => {
  const response = await answer(app, new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  if (!response) throw new Error(`no door answers ${method} ${path}`);

  return { status: response.status, text: await response.text() };
};

const filesUnder = (root: string, directory: string): Map<string, string> => {
  const files = new Map<string, string>();
  const walk = (here: string) => {
    for (const name of readdirSync(here)) {
      const path = join(here, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(root, path), readFileSync(path, 'utf8'));
    }
  };
  walk(join(root, directory));

  return files;
};

afterEach(() => vi.restoreAllMocks());

describe.each(names)('step %s', (name) => {
  const step = stepOf(name);

  it('points each letter at a line the step holds', () => {
    for (const { label, from } of step.grows) {
      expect(from.file, `${label} points at a manifest, which the page never shows`).not.toMatch(/package\.json$/);
      const source = readFileSync(join(STEPS, name, from.file), 'utf8');
      expect(source, `${label} → ${from.file}`).toContain(from.line);
    }
  });

  it.runIf(step.try?.request !== undefined)('answers "try it" as the page prints it', async () => {
    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => { logged.push(args.join(' ')); });
    const app = await testApp({ root: join(STEPS, name) });
    const request = step.try!.request!;
    let path = request.path;
    if (path.includes(':id')) {
      const created = await send(app, 'POST', '/api/blog/posts', { title: 'Hi' });
      path = path.replace(':id', JSON.parse(created.text).id);
    }
    if (request.twice) await send(app, request.method, path, request.body);
    const answered = await send(app, request.method, path, request.body);

    expect(answered.status).toBe(step.try!.status);
    if (step.try!.contains) expect(answered.text).toContain(step.try!.contains);
    if (step.try!.log) expect(logged).toContain(step.try!.log);
    await app.dispose();
  });
});

describe('what the steps say beside "try it"', () => {
  it('step 1 lets a PATCH publish, which step 3 closes', async () => {
    for (const [name, status] of [['1-crud', 200], ['3-a-rule', 400]] as const) {
      const app = await testApp({ root: join(STEPS, name) });
      const created = JSON.parse((await send(app, 'POST', '/api/blog/posts', { title: 'Hi' })).text);
      const patched = await send(app, 'PATCH', `/api/blog/posts/${created.id}`, { status: 'published' });

      expect(patched.status, name).toBe(status);
      if (status === 400) expect(patched.text).toContain('status: Read-only');
      await app.dispose();
    }
  });

  it('step 4 refuses a second Mailer, naming both', async () => {
    // Among the steps, so the copy resolves the same packages and the same tsconfig.
    const copy = mkdtempSync(join(STEPS, '.what-if-'));
    cpSync(join(STEPS, '4-a-port'), copy, { recursive: true });
    writeFileSync(join(copy, 'fronds/blog/services/FakeMailer.ts'),
      "import Mailer from './Mailer.js';\n\nexport default class FakeMailer extends Mailer {\n  async send(): Promise<void> {}\n}\n");

    try {
      await expect(testApp({ root: copy })).rejects.toThrow(/port-implemented-twice[\s\S]*(ConsoleMailer[\s\S]*FakeMailer|FakeMailer[\s\S]*ConsoleMailer)/);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  it('step 5 stands AuditMailer in front of ConsoleMailer', async () => {
    const app = await testApp({ root: join(STEPS, '5-a-link') });
    const mailer = app.extensionPoints().find((one) => one.point === 'Mailer');

    expect(mailer?.answers).toEqual(['AuditMailer', 'ConsoleMailer']);
    await app.dispose();
  });

  it('step 6 moves the mailer and its link into mail', async () => {
    const app = await testApp({ root: join(STEPS, '6-a-fact') });
    const mailer = app.extensionPoints().find((one) => one.point === 'Mailer');

    expect(mailer).toMatchObject({ frond: 'mail', answers: ['AuditMailer', 'ConsoleMailer'] });
    await app.dispose();
  });

  it('step 5 changes no handler of step 4', () => {
    const handlers = (name: string) => filesUnder(join(STEPS, name), 'fronds/blog/handlers');

    expect(handlers('5-a-link')).toEqual(handlers('4-a-port'));
  });

  it('steps 2, 7 and 8 change no line under fronds/', () => {
    for (const [name, before] of [['2-a-source', '1-crud'], ['7-an-app', '6-a-fact'], ['8-split', '7-an-app']]) {
      expect(filesUnder(join(STEPS, name), 'fronds'), name).toEqual(filesUnder(join(STEPS, before), 'fronds'));
    }
  });

  it('step 0 is what npm create fougere --bare writes', () => {
    const starter = join(import.meta.dirname, '..', '..', '..', 'packages', 'cli', 'templates', 'workspace');
    const written = (root: string, file: string) => readFileSync(join(root, file), 'utf8');

    expect(written(join(STEPS, '0-start'), 'fougere.config.ts')).toBe(written(starter, 'fougere.config.ts'));
    expect(JSON.parse(written(join(STEPS, '0-start'), 'package.json')))
      .toEqual({ ...JSON.parse(written(starter, 'package.json')), name: 'my-blog' });
  });

  it('step 2 refuses the boot until the table exists, as "try it" prints', async () => {
    const copy = mkdtempSync(join(STEPS, '.what-if-'));
    cpSync(join(STEPS, '2-a-source'), copy, { recursive: true });

    try {
      await expect(bootApp(copy)).rejects.toThrow(/the database is missing 1 change\(s\) from the entities:[\s\S]*posts — no table/);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  it('step 7 serves what its page calls', async () => {
    const page = readFileSync(join(STEPS, '7-an-app', 'apps/nuxt/app/pages/posts.vue'), 'utf8');
    const app = await testApp({ root: join(STEPS, '7-an-app') });
    const operations = identityCardOf(app).fronds.flatMap((frond) => frond.facades)
      .filter((facade) => facade.name === 'post').flatMap((facade) => facade.ops.map((op) => op.name));

    for (const name of page.matchAll(/\(post, '(\w+)'\)/g)) expect(operations).toContain(name[1]);
    await app.dispose();
  });

  it('step 8 places mail elsewhere', async () => {
    expect(remotesOf(await loadConfig(join(STEPS, '8-split')))).toEqual({ mail: 'http://127.0.0.1:4100' });
  });
});
