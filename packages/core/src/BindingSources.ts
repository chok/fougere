import { Registry } from '@fougere/schema';
import type { BindingSourceType } from './wire/BindingSourceType.js';
import { fact, pipe } from './module/fact/sources.js';
import { collector } from './module/collector/source.js';

/**
 * Where a parameter's value comes from beyond the request itself, by kind — asked in this order,
 * before the request's own parts. Seeded by reference rather than registered at import: a bundler
 * that reads a module as free of side effects would drop the registration with it.
 */
export const BindingSources = new Registry<BindingSourceType<any>>(
  'binding source',
  'call BindingSources.register(kind, source)',
  [['fact', fact], ['pipe', pipe], ['collector', collector]],
);
