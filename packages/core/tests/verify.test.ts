import { describe, it, expect } from 'vitest';
import { verify, assertSplittable } from '../src/verify.js';
import type { FrondDescriptor } from '../src/descriptor/frond.js';

// No fixture tree, no mount, no disk. `verify` is a pure function of the graph
// the scan produces, so its test builds that graph directly — which is also the
// cheapest proof that the rule needs nothing running.

class PostHandler {}
class UserCollector {}
class PostPresenter {}
class Mailer {}

const frond = (name: string, parts: Partial<FrondDescriptor>): FrondDescriptor => ({
  name,
  source: { path: `/app/fronds/${name}`, package: `@fronds/${name}` },
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

const collector = (typeName: string, ctor: Function) =>
  ({ typeName, ctor, deps: [], filePath: `/app/${ctor.name}.ts` }) as never;

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
    // The target as a FIELD, not as prose. A reader deciding whether this
    // violation concerns a frond named in `remotes:` reads it here — parsing the
    // sentence would be a second opinion on a fact already held.
    expect(violations[0].dependsOn).toEqual({ key: 'UserCollector', frond: 'identity', kind: 'collector' });
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
      fronds: [frond('blog', { handlers: [handler(PostHandler, 'post', ['Logger', 'Config'])] })],
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
  it('names the parameter whose preliminary body interpretation must be refused', async () => {
    const { scanProject } = await import('../src/scan/scanner.js');
    const scan = await scanProject(new URL('./fixtures-collector-split', import.meta.url).pathname);

    const violations = verify({ fronds: scan.fronds }).filter((v) => v.rule === 'collector-in-another-frond');

    // Two ops, same misplacement — the spelling of the param changes nothing.
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.subject).sort()).toEqual([
      'PostHandler.whoExplicit(user)',
      'PostHandler.whoOptional(user)',
    ]);
    expect(violations[0].frond).toBe('blog');
    expect(violations[0].message).toContain("declared in frond 'identity'");
    expect(violations[0].message).toContain('preliminary body interpretation is invalid');
    expect(violations[0].message).toContain('refuses the operation');
    // What the boot filters on when `remotes:` names a frond.
    expect(violations[0].dependsOn).toEqual({ key: 'UserCollector', frond: 'identity', kind: 'collector' });
    // The consumer is 'blog', the target is 'identity' — two different fields,
    // and the pair is what a caller needs to decide anything.
    expect(violations[0].frond).not.toBe(violations[0].dependsOn.frond);
  });

  // The rule looked its parameter up with `toLowerCase()` while the index is keyed the
  // way the scan spells it. On a two-word entity that missed in BOTH directions: it
  // neither confirmed the collector was local nor found it elsewhere, so the one case
  // the rule exists for went unreported.
  it('reports a two-word entity, whose key is not its lowercase name', () => {
    const op = { signature: { name: 'draft', params: [{ name: 'author', type: { raw: 'AuthorUser', name: 'AuthorUser' } }] } };
    const withOp = (ctor: Function, entityName: string) =>
      ({ name: `${entityName}Handler`, entityName, ctor, operations: new Map([['draft', op]]), deps: [], filePath: `/app/${ctor.name}.ts` }) as never;

    const violations = verify({
      fronds: [
        frond('blog', { handlers: [withOp(PostHandler, 'post')] }),
        frond('identity', { collectors: [collector('authorUser', UserCollector)] }),
      ],
    }).filter((v) => v.rule === 'collector-in-another-frond');

    expect(violations).toHaveLength(1);
    expect(violations[0].subject).toBe('PostHandler.draft(author)');
    expect(violations[0].dependsOn.frond).toBe('identity');
  });
});
