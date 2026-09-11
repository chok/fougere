/** Fougere Logger — structured, colored, multi-runtime. */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** One line, before it was formatted for a terminal. */
export interface LogRecord {
  level: Exclude<LogLevel, 'silent'>;
  /** The logger's own name — 'boot:app', 'boot:app:catalog'. */
  name: string;
  message: string;
  args: unknown[];
  /** Epoch milliseconds. */
  at: number;
}

/** Where a line goes once it is written — `@fougere/log` ships one, `observability` another. */
export type LogSink = (record: LogRecord) => void;

/**
 * Where one boot's lines wait, and where they go once they can.
 *
 * PER BOOT and never per process: two apps in one process each have their own
 * destinations, and a slot shared between them sent the second app's lines to the first
 * app's door — measured on `demos/observability`, where only the first of three printed.
 *
 * A boot writes most of what a process ever logs, and it writes it before any emission is
 * registered, so the lines that say what an app is made of are the ones a destination
 * would miss. Bounded: a boot that never finishes must not grow, and what is dropped is
 * the OLDEST since the lines explaining a refusal are the last.
 */
export class Carry {
  private held: LogRecord[] = [];
  private take?: (line: LogRecord) => void;

  static readonly MAX = 500;

  /** Take it now, or keep it for whoever arrives. */
  push(record: LogRecord): void {
    if (this.take) {
      try {
        this.take(record);
      } catch { /* announcing never breaks logging, for the same reason a sink does not */ }
      return;
    }
    this.held.push(record);
    if (this.held.length > Carry.MAX) this.held.shift();
  }

  /** Hand what is held over, and everything after it. */
  to(take: (line: LogRecord) => void): () => void {
    this.take = take;
    for (const line of this.held.splice(0)) take(line);

    return () => { this.take = undefined; };
  }

  /**
   * Forget what is still held — a boot that refused, or an app that declares no
   * destination. Nothing is printed: the console had every one of these lines when it was
   * written, and the hold exists only to hand them on later.
   */
  forget(): void {
    this.held.length = 0;
  }
}

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

/** The level, held ONCE for the process and CONSULTED at every emission. */
let threshold: number = LEVELS[envLevel() ?? 'info'];

/** The level the PROCESS was started with. */
export function envLevel(): LogLevel | undefined {
  const raw = typeof process === 'undefined' ? undefined : process.env.FOUGERE_LOG_LEVEL;
  return raw !== undefined && raw in LEVELS ? (raw as LogLevel) : undefined;
}

/** Set the level for every logger in this process, at once. */
export function setLogLevel(level: LogLevel): void {
  if (!(level in LEVELS)) {
    throw new Error(`Unknown log level: '${level}'. One of ${Object.keys(LEVELS).join(', ')}.`);
  }
  threshold = LEVELS[level];
}

/** What the level is now — the dual, so a reload can report what it changed. */
export function logLevel(): LogLevel {
  return (Object.keys(LEVELS) as LogLevel[]).find((l) => LEVELS[l] === threshold) ?? 'info';
}

const COLORS: Record<string, string> = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const LEVEL_STYLE: Record<string, { badge: string; color: string }> = {
  debug: { badge: 'DBG', color: 'gray' },
  info:  { badge: 'INF', color: 'green' },
  warn:  { badge: 'WRN', color: 'yellow' },
  error: { badge: 'ERR', color: 'red' },
};

function supportsColor(): boolean {
  if (typeof process !== 'undefined') {
    if (process.env.NO_COLOR) return false;
    if (process.env.FORCE_COLOR === '1') return true;
    return process.stdout?.isTTY === true;
  }
  return false;
}

function stamp(at: number | Date): string {
  const d = new Date(at);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export interface LoggerOptions {
  /** Logger name / prefix. */
  name?: string;
  /**
   * Where its lines go — one boot's, so two apps in a process do not share a door. A
   * logger without one writes to the console and nowhere else, which is what the boot's
   * first lines do and what an app declaring no destination does forever.
   */
  carry?: Carry;
  /** Force color on/off. Auto-detected by default. */
  color?: boolean;
}

export class Logger {
  private name: string;
  private color: boolean;
  private carry?: Carry;

  constructor(prefix?: string, options?: Omit<LoggerOptions, 'name'>) {
    this.name = prefix ?? 'app';
    this.color = options?.color ?? supportsColor();
    this.carry = options?.carry;
  }

  /** Create a child logger with a sub-name. It carries no level of its own either. */
  child(name: string): Logger {
    return new Logger(`${this.name}:${name}`, { color: this.color, ...(this.carry ? { carry: this.carry } : {}) });
  }

  debug(msg: string, ...args: unknown[]) { this.log('debug', msg, args); }
  info(msg: string, ...args: unknown[])  { this.log('info', msg, args); }
  warn(msg: string, ...args: unknown[])  { this.log('warn', msg, args); }
  error(msg: string, ...args: unknown[]) { this.log('error', msg, args); }

  private log(level: string, msg: string, args: unknown[]) {
    if (LEVELS[level as LogLevel] < threshold) return;
    const record: LogRecord = {
      level: level as LogRecord['level'], name: this.name, message: msg, args, at: Date.now(),
    };

    this.carry?.push(record);

    // The console ALWAYS, whoever else took the line. Skipping it once a destination
    // existed made `calls()` — a devtools ring that prints nothing — silence the
    // operator's terminal: 306 per-operation lines in `demos/observability` became 2.
    // A destination sends a line ELSEWHERE; it does not take over stderr.
    const { method, text } = formatted(record, this.color);
    console[method](...text);
  }
}

/**
 * One line, ready for a terminal — the console arguments and which method takes them.
 *
 * Here rather than inside the class because the boot is not the only writer: a destination
 * that prints (`@fougere/log`) hands its own record to the same formatting, so the two
 * outputs cannot drift.
 *
 * One console method per level: `debug` and `info` both went to `console.log`, so nothing
 * downstream — a terminal filter, a collector — could tell them apart.
 */
export interface Rendered {
  level: Exclude<LogLevel, 'silent'>;
  name: string;
  message: string;
  /** Absent on most lines: a message usually carries its own detail. */
  args?: unknown[] | null;
  /** Epoch milliseconds from a logger, a `Date` from an entity that stamped it. */
  at: number | Date;
}

export function formatted(
  record: Rendered,
  color = supportsColor(),
): { method: Rendered['level']; text: unknown[] } {
  const style = LEVEL_STYLE[record.level];
  const time = stamp(record.at);
  const method = record.level;

  if (color) {
    const c = COLORS[style.color];
    const prefix = `${COLORS.dim}${time}${COLORS.reset} ${c}${COLORS.bold}${style.badge}${COLORS.reset} ${COLORS.magenta}${record.name}${COLORS.reset}`;

    return { method, text: [prefix, record.message, ...(record.args ?? [])] };
  }

  return { method, text: [`${time} ${style.badge} [${record.name}]`, record.message, ...(record.args ?? [])] };
}
