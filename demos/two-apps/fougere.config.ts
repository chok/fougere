import '@fougere/adapter-sql';
import '@fougere/services';
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
 *
 * `services:` is what `fougere up` starts before any of them: a Redis in Docker, and a command —
 * each told to the rest as `CACHE_URL` and `FILES_URL`, unless the environment already gives one.
 */
export default defineFougere({
  sources: { main: { type: 'sqlite', path: '.data/notes.db' } },
  platform: base,
  apps: {
    api: { platform: observed },
  },
  services: {
    cache: { type: 'docker', image: 'redis:7-alpine', port: 6379, scheme: 'redis' },
    files: { type: 'process', command: 'python3 -m http.server 7711 --bind 127.0.0.1', port: 7711, health: '/' },
  },
  processes: {
    clock: { url: 'http://127.0.0.1:4710', fronds: ['clock'], platform: observed },
  },
});
