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

export type LogSink = (record: LogRecord) => void;

/** Who else takes this process's log lines, beside the console. */
const sinks: LogSink[] = [];

/** Take every line this process logs. Returns the way to withdraw. */
export function onLog(next: LogSink): () => void {
  sinks.push(next);
  return () => {
    const at = sinks.indexOf(next);
    if (at >= 0) sinks.splice(at, 1);
  };
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

function formatTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export interface LoggerOptions {
  /** Logger name / prefix. */
  name?: string;
  /** Force color on/off. Auto-detected by default. */
  color?: boolean;
}

export class Logger {
  private name: string;
  private color: boolean;

  constructor(prefix?: string, options?: Omit<LoggerOptions, 'name'>) {
    this.name = prefix ?? 'app';
    this.color = options?.color ?? supportsColor();
  }

  /** Create a child logger with a sub-name. It carries no level of its own either. */
  child(name: string): Logger {
    return new Logger(`${this.name}:${name}`, { color: this.color });
  }

  debug(msg: string, ...args: unknown[]) { this.log('debug', msg, args); }
  info(msg: string, ...args: unknown[])  { this.log('info', msg, args); }
  warn(msg: string, ...args: unknown[])  { this.log('warn', msg, args); }
  error(msg: string, ...args: unknown[]) { this.log('error', msg, args); }

  private log(level: string, msg: string, args: unknown[]) {
    if (LEVELS[level as LogLevel] < threshold) return;

    // Beside the console, never instead of it: a forwarded line is an addition, and a
    // sink that throws must not cost the operator the line they were reading.
    for (const take of sinks) {
      try {
        take({ level: level as LogRecord['level'], name: this.name, message: msg, args, at: Date.now() });
      } catch { /* forwarding never breaks logging */ }
    }

    const style = LEVEL_STYLE[level];
    const time = formatTime();
    // One console method per level. `debug` and `info` both went to `console.log`, so
    // nothing downstream — a terminal filter, a collector — could tell them apart.
    const method = level as 'debug' | 'info' | 'warn' | 'error';

    if (this.color) {
      const c = COLORS[style.color];
      const prefix = `${COLORS.dim}${time}${COLORS.reset} ${c}${COLORS.bold}${style.badge}${COLORS.reset} ${COLORS.magenta}${this.name}${COLORS.reset}`;
      console[method](prefix, msg, ...args);
    } else {
      console[method](`${time} ${style.badge} [${this.name}]`, msg, ...args);
    }
  }
}
