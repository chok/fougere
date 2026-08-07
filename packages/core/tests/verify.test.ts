import { describe, it, expect } from 'vitest';
import { verify, assertSplittable } from '../src/verify.js';
import type { FrondDescriptor } from '../src/types.js';

// No fixture tree, no mount, no disk. `verify` is a pure function of the graph
// the scan produces, so its test builds that graph directly — which is also the
// cheapest proof that the rule needs nothing running.

class PostHandler {}
class UserCollector {}
class PostPresenter {}
class Mailer {}

const frond = (name: string, parts: Partial<FrondDescriptor>): FrondDescriptor => ({
  name,
  source: { path: `/app/fronds/${name}`, package: `@frond/${name}` },
  providers: [],
  entities: [],
  handlers: [],
  presenters: [],
  collectors: [],
  seeds: [],
  ...parts,
});

// `operations` is a Map in the real descriptor, not an object — a hand-built
// graph that spells it `{}` type-checks and then diverges from every app the
// scan produces. Which is why the collector rule below is tested on a scanned
// fixture, not on this.
const handler = (ctor: Function, entityName: string, deps: string[]) =>
  ({ name: `${entityName}Handler`, entityName, ctor, operations: new Map(), deps, filePath: `/app/${ctor.name}.ts` }) as never;

const collector = (entityName: string, ctor: Function) =>
  ({ entityName, ctor, deps: [], filePath: `/app/${ctor.name}.ts` }) as never;

const presenter = (entityName: string, ctor: Function, deps: string[]) =>
  ({ entityName, ctor, fields: [], fieldMeta: [], deps, filePath: `/app/${ctor.name}.ts` }) as never;

describe('verify — cross-frond dependency', () => {
  it('names the handler that will lose its collector at the split', () => {
    const app = {
      fronds: [
        frond('blog', { handlers: [handler(PostHandler, 'post', ['UserCollector'])] }),
        frond('identity', { collectors: [collector('user', UserCollector)] }),
      ],
    };

    const violations = verify(app);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('cross-frond-dependency');
    expect(violations[0].frond).toBe('blog');
    expect(violations[0].subject).toBe('PostHandler');
    // The message carries the sentence `Known issues` asks a human to remember —
    // and states the mechanism, per-frond scopes, rather than a topology that has
    // nothing to do with it.
    expect(violations[0].message).toContain("collector of frond 'identity'");
    expect(violations[0].message).toContain('its own scope');
  });

  it('says nothing when the collector lives in the consuming frond', () => {
    const app = {
      fronds: [
        frond('blog', {
          handlers: [handler(PostHandler, 'post', ['UserCollector'])],
          collectors: [collector('user', UserCollector)],
        }),
      ],
    };

    expect(verify(app)).toEqual([]);
  });

  it('leaves builtins alone — they are registered in the root, not in a frond', () => {
    const app = {
      fronds: [frond('blog', { handlers: [handler(PostHandler, 'post', ['Logger', 'Config', 'EventBus'])] })],
    };

    expect(verify(app)).toEqual([]);
  });

  it('catches a presenter reaching across, not only a handler', () => {
    const app = {
      fronds: [
        frond('blog', { presenters: [presenter('post', PostPresenter, ['Mailer'])] }),
        frond('ops', { providers: [{ name: 'mailer', ctor: Mailer, deps: [], filePath: '/app/Mailer.ts' } as never] }),
      ],
    };

    const violations = verify(app);

    expect(violations).toHaveLength(1);
    expect(violations[0].subject).toBe('PostPresenter');
    expect(violations[0].message).toContain("provider of frond 'ops'");
  });

  it('assertSplittable throws with every violation spelled out', () => {
    const app = {
      fronds: [
        frond('blog', { handlers: [handler(PostHandler, 'post', ['UserCollector'])] }),
        frond('identity', { collectors: [collector('user', UserCollector)] }),
      ],
    };

    expect(() => assertSplittable(app)).toThrow(/does not survive a split/);
    expect(() => assertSplittable(app)).toThrow(/PostHandler/);
  });

  it('passes an app that has no frond boundary to cross', () => {
    expect(() => assertSplittable({ fronds: [] })).not.toThrow();
  });
});

describe('verify — collector in another frond', () => {
  it('names the parameter that will take the request body', async () => {
    const { scanProject } = await import('../src/scanner.js');
    const scan = await scanProject(new URL('./fixtures-collector-split', import.meta.url).pathname);

    const violations = verify({ fronds: scan.fronds }).filter((v) => v.rule === 'collector-in-another-frond');

    // Two ops, same misplacement — the spelling of the param changes nothing.
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.subject).sort()).toEqual([
      'PostHandler.whoNull(user)',
      'PostHandler.whoOptional(user)',
    ]);
    expect(violations[0].frond).toBe('blog');
    expect(violations[0].message).toContain("declared in frond 'identity'");
    expect(violations[0].message).toContain('falls through to the request body');
  });
});
