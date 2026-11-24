import { describe, it, expect } from 'vitest';
import { Topology } from '../src/config/Topology.js';
import type { Extension } from '../src/boot/Extension.js';

const named = (name: string): Extension => ({ name, up() {} });

const processes = {
  blog: { url: 'http://127.0.0.1:4100', fronds: ['blog'] },
  mail: { url: 'http://127.0.0.1:4200', fronds: ['mail', 'audit'] },
};

describe('a config with no processes:', () => {
  it('runs as one process, holding every frond', () => {
    expect(Topology.of({}).placement(undefined)).toEqual({ remotes: {}, platform: [] });
  });

  it('refuses a process named, since it states none', () => {
    expect(() => Topology.of({}).placement('blog'))
      .toThrow("fougere.config.ts states no processes:, so this project runs as one process — start it without naming 'blog'.");
  });
});

describe('a config that places fronds in other processes', () => {
  const topology = Topology.of({ processes });

  it('runs, as an app, every frond it places nowhere, and reaches the others at their url', () => {
    expect(topology.placement(undefined).remotes)
      .toEqual({ blog: 'http://127.0.0.1:4100', mail: 'http://127.0.0.1:4200', audit: 'http://127.0.0.1:4200' });
  });

  it('runs, as a process named, its fronds alone', () => {
    expect(topology.placement('blog')).toEqual({
      only: ['blog'],
      remotes: { mail: 'http://127.0.0.1:4200', audit: 'http://127.0.0.1:4200' },
      url: 'http://127.0.0.1:4100',
      platform: [],
    });
  });

  it('refuses a process it does not state, naming the ones it does', () => {
    expect(() => topology.placement('search')).toThrow("fougere.config.ts states no process 'search' under processes:. It states blog, mail.");
  });

  it('reads FOUGERE_PROCESS when no name is given', () => {
    process.env.FOUGERE_PROCESS = 'mail';
    try {
      expect(topology.placement().only).toEqual(['mail', 'audit']);
    } finally {
      delete process.env.FOUGERE_PROCESS;
    }
  });

  it('refuses a frond run by two processes', () => {
    expect(() => Topology.of({ processes: { a: { url: 'http://a', fronds: ['blog'] }, b: { url: 'http://b', fronds: ['blog'] } } }))
      .toThrow("fougere.config.ts: processes.b runs 'blog', which processes.a runs too. A frond runs in one process.");
  });
});

describe('what each one carries', () => {
  const base = [named('log')];
  const observed = [...base, named('traces')];
  const topology = Topology.of({
    platform: base,
    apps: { web: { platform: observed } },
    processes: { search: { url: 'http://127.0.0.1:4200', fronds: ['search'], platform: observed }, blog: processes.blog },
  });

  it('gives an app or a process that states nothing the platform: of the config', () => {
    expect(topology.placement(undefined, 'ops').platform).toBe(base);
    expect(topology.placement('blog').platform).toBe(base);
  });

  it('gives one that states its own exactly that list, with nothing of the default added', () => {
    expect(topology.placement(undefined, 'web').platform).toBe(observed);
    expect(topology.placement('search').platform).toBe(observed);
  });
});
