import type { Axis } from '../Axis.js';
import { Format } from '../../lib/Format.js';
import { CREATE_TOKENS, UPDATE_TOKENS, type LifecycleRules } from './LifecycleRules.js';

export const lifecycleAxis: Axis<LifecycleRules, LifecycleRules> = {
  slot: 'lifecycle',

  format: Format.of('axis/lifecycle')
    .key(
      'create',
      Format.either(
        Format.tokens(CREATE_TOKENS),
        Format.exactlyOne({ value: Format.anything, generate: Format.text }),
      ),
    )
    .key('update', Format.tokens(UPDATE_TOKENS))
    .closed(),

  describe: (value) => value,
  reconstruct: (wire) => wire,
};
