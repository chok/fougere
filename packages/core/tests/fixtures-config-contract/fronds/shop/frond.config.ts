import { defineFrond } from '@fougere/core/node';
import Note from './entities/Note.js';

/**
 * Config as the third producer of an operation contract — alongside a prefab's `__ops`
 * and the scan. The façade cannot tell the three apart.
 */
export default defineFrond({
  operations: {
    // The scan derived the binding (an object param → body) but no judge. Name it.
    retitle: {
      input: Note.pick('title'),
    },
    // The scan never saw this method. State the whole contract and it exists.
    archive: {
      kind: 'command',
      binding: [{ name: 'id', source: { kind: 'param', name: 'id' }, optional: false }],
    },
  },
});
