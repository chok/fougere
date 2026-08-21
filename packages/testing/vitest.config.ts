// Its own configuration, from its own source: this package cannot import its `dist`
// before building it.
import { fougereTest } from './src/vitest.js';

export default fougereTest({ test: { include: ['tests/**/*.test.ts'] } });
