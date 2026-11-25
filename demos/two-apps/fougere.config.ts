import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';
import { log } from '@fougere/log';
import { calls } from '@fougere/calls';

const base = [log()];
const observed = [...base, calls()];

/**
 * Two apps over the same fronds, and one process, each carrying what it needs.
 *
 * `apps/api` and `apps/ops` both run `notes` — every frond `processes:` places nowhere — and
 * read their name off their directory. `api` keeps a ring of every call it answered; `ops`, a
 * terminal, states nothing and carries the default. `clock` runs alone at its url, and carries
 * the same list as `api`: one variable, named once.
 */
export default defineFougere({
  sources: { main: { type: 'sqlite', path: '.data/notes.db' } },
  platform: base,
  apps: {
    api: { platform: observed },
  },
  processes: {
    clock: { url: 'http://127.0.0.1:4710', fronds: ['clock'], platform: observed },
  },
});
