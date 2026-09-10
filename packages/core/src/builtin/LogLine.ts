import { entity, oneOf, text, json, list, optional, created } from '@fougere/schema';

/**
 * One line. A fact about the process, announced like any other — which is what makes a
 * destination an ordinary handler and `remotes:` the only thing that decides where it runs.
 *
 * Here and not in `@fougere/log`, because the BOOT announces: core would otherwise have to
 * name an optional package's entity to reach its own lines. What is optional is where a
 * line GOES, and that is what `@fougere/log` ships.
 *
 * No `primary()`: an id costs 87 µs to generate (cuid2), and nothing addresses a line
 * by one. `at` is `created()`, so announcing is what fills it.
 */
export default class LogLine extends entity({
  level: oneOf('debug', 'info', 'warn', 'error'),
  /** Who wrote it — 'app', 'app:catalog'. */
  name: text(),
  message: text({ min: 1 }),
  /** What the writer passed beside the message — most lines pass none. */
  args: optional(list(json())),
  at: created(),
}) {}
