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

/** The fact a boot announces, spelled once. */
export const LOG_LINE = 'logLine';

/**
 * The addresses whose operations CARRY a line — every destination this app installed.
 *
 * Whatever carries a fact must not produce one, or the emission refuses it by name:
 * keeping a line is a DISPATCH, so logging it announces a line inside the announcement of
 * one. FILLED BY THE BOOT from what binds `logLine`, not written down — a hard-coded list
 * cannot know a third party's destination, and the app already knows who subscribed.
 *
 * Read by `loggerMiddleware` and by `observability`'s `trace()`, both of which observe
 * every operation and would otherwise observe the observation.
 */
export const CARRIES_LINE = new Set<string>();
