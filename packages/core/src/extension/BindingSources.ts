import { Registry } from '@fougere/registry';
import type { BindingSourceType } from '../wire/BindingSourceType.js';
import { fact, pipe } from '../module/fact/sources.js';
import { collector } from '../module/collector/source.js';
import { state } from '../module/state/source.js';

/** Where a parameter's value comes from besides the request, by kind, asked in this order. */
export const BindingSources = new Registry<BindingSourceType<any>>(
  'binding source',
  'call BindingSources.register(kind, source)',
  [['fact', fact], ['pipe', pipe], ['collector', collector], ['state', state]],
);
