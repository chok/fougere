import { describe, expect, it } from 'vitest';
import { Invocation } from '../src/contract/Invocation.js';
import { ArgumentResolver } from '../src/dispatch/ArgumentResolver.js';
import { presenterArguments } from '../src/dispatch/presenterArguments.js';
import type { PresenterEntry } from '../src/descriptor/frond.js';

describe('presenterArguments', () => {
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

    await expect(presenterArguments(meta, Invocation.from({ query: { prefix: '#' } }), new ArgumentResolver(), new Set()))
      .resolves.toEqual({ viewerLabel: ['#'] });
  });
});
