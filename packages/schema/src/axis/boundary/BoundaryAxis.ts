import type { Axis } from '../Axis.js';
import { Format } from '../../lib/Format.js';
import type { BoundaryRef } from './BoundaryRef.js';

const closedOr = (verb: 'decode' | 'encode'): Format =>
  Format.either(
    Format.tokens(['closed']),
    Format.of().key(verb, Format.text).needs(verb).closed(),
  );

export const boundaryAxis: Axis<BoundaryRef, BoundaryRef> = {
  slot: 'boundary',

  format: Format.named(
    'axis/boundary',
    Format.either(
      Format.text,
      Format.of().key('in', closedOr('decode')).key('out', closedOr('encode')).closed(),
    ),
  ),

  describe: (value) => value,
  reconstruct: (wire) => wire,
};
