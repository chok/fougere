import { entity, oneOf, text, json, list, optional, created } from '@fougere/schema';

/**
 * One line. A fact about the process, announced like any other — which is what makes a
 * destination an ordinary handler and `remotes:` the only thing that decides where it runs.
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
