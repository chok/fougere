import { entity, oneOf, text, json, list, optional, created } from '@fougere/schema';

/** One log line, announced like any other fact. */
export default class LogLine extends entity({
  level: oneOf('debug', 'info', 'warn', 'error'),
  /** Who wrote it — 'app', 'app:catalog'. */
  name: text(),
  message: text({ min: 1 }),
  /** The operation it was written inside — 'blog:PostHandler.publish'. */
  during: optional(text()),
  /** What the writer passed beside the message — most lines pass none. */
  args: optional(list(json())),
  at: created(),
}) {}

/** The fact a boot announces, spelled once. */
export const LOG_LINE = 'logLine';

/** The addresses whose operations carry a line; filled by the boot. */
export const CARRIES_LINE = new Set<string>();
