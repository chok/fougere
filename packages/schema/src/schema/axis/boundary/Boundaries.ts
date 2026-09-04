import type { BoundaryRules } from './Boundary.js';
import { Registry } from '../../../Registry.js';

export type Decoder = (value: unknown) => { value: unknown } | { error: string };
export type Encoder = (value: unknown) => unknown;

/**
 * `decoders` for a value coming in, `encoders` for one going out, `aliases` for the word
 * that names a pair. Three registries, so a codec is never half declared.
 * FR : `decoders` à l'entrée, `encoders` à la sortie, `aliases` pour le mot qui nomme la paire.
 * `Boundaries.aliases.register('isoDate', { in: { decode: 'isoDate' }, out: { encode: 'isoDate' } })`
 * → a field saying `boundary: 'isoDate'` decodes to a `Date` and leaves as a string
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
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? { error: 'Invalid date' } : { value: d };
  }
  return { error: 'Expected a date' };
});
Boundaries.encoders.register('isoDate', (value) =>
  value instanceof Date ? value.toISOString() : value,
);
Boundaries.aliases.register('isoDate', { in: { decode: 'isoDate' }, out: { encode: 'isoDate' } });
