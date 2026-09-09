import { describe, expect, it } from 'vitest';
import { Invocation } from '../src/wire/Invocation.js';
import { ArgumentResolver } from '../src/dispatch/ArgumentResolver.js';
import { presenterArguments, presenterPlans } from '../src/dispatch/presenterArguments.js';
import type { PresenterEntry } from '../src/descriptor/frond.js';

const meta = {
  fieldMeta: [
    { name: 'label', params: [] },
    {
      name: 'viewerLabel',
      params: [{
        name: 'prefix',
        optional: false,
        type: { raw: 'string', name: 'string' },
      }],
    },
  ],
} as PresenterEntry;

describe('a presenter reads its plan once and its values per call', () => {
  it('plans only the fields that declare invocation-dependent parameters', () => {
    const plans = presenterPlans(meta, new Set());

    expect([...plans.keys()]).toEqual(['viewerLabel']);
    expect(plans.get('viewerLabel')).toEqual([
      { name: 'prefix', source: { kind: 'param', name: 'prefix' }, optional: false },
    ]);
  });

  it('resolves those plans against the invocation it is handed', async () => {
    await expect(presenterArguments(
      presenterPlans(meta, new Set()),
      Invocation.from({ query: { prefix: '#' } }),
      new ArgumentResolver(),
    )).resolves.toEqual({ viewerLabel: ['#'] });
  });

  it('answers two invocations from one plan without carrying the first over', async () => {
    const plans = presenterPlans(meta, new Set());
    const resolver = new ArgumentResolver();

    const first = await presenterArguments(plans, Invocation.from({ query: { prefix: '#' } }), resolver);
    const second = await presenterArguments(plans, Invocation.from({ query: { prefix: '@' } }), resolver);

    expect(first).toEqual({ viewerLabel: ['#'] });
    expect(second).toEqual({ viewerLabel: ['@'] });
  });
});
