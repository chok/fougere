import type { BoundaryRules } from './Boundary.js';
import { Registry } from '@fougere/registry';
import type { Encoder } from './Encoder.js';
import type { Verdict } from '../../lib/Verdict.js';

/** Turns a wire value into a domain value, and accepts a value it already produced. */
export type Decoder = (value: unknown) => Verdict;

/**
 * The codecs by name: `decoders` in, `encoders` out, `aliases` for a pair.
 * Ex: `Boundaries.aliases.register('isoDate', { in: { decode: 'isoDate' }, out: { encode: 'isoDate' } })`.
 */
export const Boundaries = {
  decoders: new Registry<Decoder>(
    'boundary decoder',
    'call Boundaries.decoders.register(name, fn)',
  ),
  encoders: new Registry<Encoder>(
    'boundary encoder',
    'call Boundaries.encoders.register(name, fn)',
  ),
  aliases: new Registry<BoundaryRules>('boundary alias'),
};

Boundaries.decoders.register('isoDate', (value) => {
  if (value instanceof Date) return { value };
  if (typeof value === 'string') {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? { message: 'Invalid date' } : { value: date };
  }

  return { message: 'Expected a date' };
});
Boundaries.encoders.register('isoDate', (value) =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : value,
);
Boundaries.aliases.register('isoDate', { in: { decode: 'isoDate' }, out: { encode: 'isoDate' } });
