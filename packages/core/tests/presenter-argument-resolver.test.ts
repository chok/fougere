import { describe, expect, it } from 'vitest';
import { Invocation } from '../src/contract/Invocation.js';
import { ArgumentResolver } from '../src/dispatch/ArgumentResolver.js';
import { PresenterArgumentResolver } from '../src/dispatch/PresenterArgumentResolver.js';
import type { PresenterEntry } from '../src/scan/frond.js';

describe('PresenterArgumentResolver', () => {
  it('resolves only fields that declare invocation-dependent parameters', async () => {
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
    const resolver = new PresenterArgumentResolver(new ArgumentResolver(), new Set());

    await expect(resolver.resolve(meta, Invocation.from({ query: { prefix: '#' } })))
      .resolves.toEqual({ viewerLabel: ['#'] });
  });
});
