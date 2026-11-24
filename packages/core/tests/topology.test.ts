import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Topology } from '../src/project/Topology.js';

const SPLIT = `
processes:
  blog: { url: http://127.0.0.1:4100, fronds: [blog] }
  mail: { url: http://127.0.0.1:4200, fronds: [mail, audit] }
`;

describe('a project with no fougere.topology.yaml', () => {
  it('runs as one process, holding every frond', () => {
    expect(Topology.of(mkdtempSync(join(tmpdir(), 'topology-'))).placement(undefined)).toEqual({ remotes: {} });
  });

  it('refuses a process named, since it states none', () => {
    expect(() => Topology.of(mkdtempSync(join(tmpdir(), 'topology-'))).placement('blog'))
      .toThrow("There is no fougere.topology.yaml, so this project runs as one process — start it without naming 'blog'.");
  });
});

describe('a project that places fronds in other processes', () => {
  const topology = Topology.parse(SPLIT);

  it('runs, as the app, every frond it places nowhere, and reaches the others at their url', () => {
    expect(topology.placement(undefined)).toEqual({
      remotes: { blog: 'http://127.0.0.1:4100', mail: 'http://127.0.0.1:4200', audit: 'http://127.0.0.1:4200' },
    });
  });

  it('runs, as a process named, its fronds alone', () => {
    expect(topology.placement('blog')).toEqual({
      only: ['blog'],
      remotes: { mail: 'http://127.0.0.1:4200', audit: 'http://127.0.0.1:4200' },
      url: 'http://127.0.0.1:4100',
    });
  });

  it('refuses a process it does not state, naming the ones it does', () => {
    expect(() => topology.placement('search')).toThrow("fougere.topology.yaml states no process 'search'. It states blog, mail.");
  });

  it('reads FOUGERE_PROCESS when no name is given', () => {
    process.env.FOUGERE_PROCESS = 'mail';
    try {
      expect(topology.placement().only).toEqual(['mail', 'audit']);
    } finally {
      delete process.env.FOUGERE_PROCESS;
    }
  });

  it('is found from a directory under the project', () => {
    const root = mkdtempSync(join(tmpdir(), 'topology-'));
    writeFileSync(join(root, 'fougere.topology.yaml'), SPLIT);
    mkdirSync(join(root, 'apps', 'web'), { recursive: true });

    expect(Topology.of(join(root, 'apps', 'web')).addresses()).toHaveProperty('blog', 'http://127.0.0.1:4100');
  });
});

describe('a file that does not hold', () => {
  it('refuses a frond run by two processes', () => {
    expect(() => Topology.parse('processes: { a: { url: http://a, fronds: [blog] }, b: { url: http://b, fronds: [blog] } }'))
      .toThrow("the frond 'blog' is run by 'a' and by 'b'. A frond runs in one process.");
  });

  it('refuses a process with no url, since the app is the one nobody reaches', () => {
    expect(() => Topology.parse('processes: { web: { fronds: [blog] } }')).toThrow(/fougere\.topology\.yaml: processes\.web/);
  });

  it('refuses a key it does not know, under its own name', () => {
    expect(() => Topology.parse('processes: { a: { url: http://a, fronds: [blog], remote: http://x } }'))
      .toThrow(/fougere\.topology\.yaml: processes\.a/);
  });

  it('refuses a file with no processes', () => {
    expect(() => Topology.parse('sets: {}')).toThrow(/fougere\.topology\.yaml/);
  });
});

describe('a url that differs by environment', () => {
  const text = 'processes: { catalog: { url: "${CATALOG_URL:-binding://CATALOG}", fronds: [catalog] } }';

  it('reads the variable it names, as Compose does', () => {
    expect(Topology.parse(text, { CATALOG_URL: 'https://catalog.dev' }).addresses()).toEqual({ catalog: 'https://catalog.dev' });
  });

  it('falls back on what follows :- when the variable is unset', () => {
    expect(Topology.parse(text, {}).addresses()).toEqual({ catalog: 'binding://CATALOG' });
  });

  it('refuses a variable unset with no fallback, naming it', () => {
    expect(() => Topology.parse('processes: { a: { url: "${A_URL}", fronds: [a] } }', {}))
      .toThrow('fougere.topology.yaml reads ${A_URL}, which the environment does not set.');
  });
});
