import { defineFougere } from '@fougere/core';

/**
 * A consumer: it hosts nothing and stores nothing.
 *
 * No `sources:` is not a workaround for the Worker — it is what an app that owns no row
 * declares anywhere. `sources:` says what THIS PROCESS stores, never what the app can reach.
 * Where `catalog` answers is `fougere.topology.yaml`'s, beside this file.
 */
export default defineFougere({});
