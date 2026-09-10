// The configuration this repo already ships, and the reason it exists: without
// `deps.inline` on `@fougere/*` the frond's own source is transformed twice.
import { fougereTest } from '../testing/src/vitest.js';

export default fougereTest();
