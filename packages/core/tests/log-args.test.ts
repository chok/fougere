/**
 * What a line carries away, beside what it prints.
 *
 * `LogLine.args` states `json()`, and a `json()` is an object — a destination refused
 * `log.info('cache miss', 42)` for it, naming a drift that had not happened. The console is
 * for a human and the fact for a machine, so the wrapping is on the way out, not on the line
 * the terminal shows.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Carry, Logger } from '../src/index.js';
import type { LogRecord } from '../src/builtin/LogRecord.js';

afterEach(() => { vi.restoreAllMocks(); });

describe('a scalar handed to a logger', () => {
  const announced = () => {
    const carry = new Carry();
    const lines: LogRecord[] = [];
    carry.to((line) => lines.push(line));

    return { log: new Logger('app', { carry }), lines };
  };

  it('travels as an object, and an object travels as itself', () => {
    const { log, lines } = announced();
    vi.spyOn(console, 'info').mockImplementation(() => {});

    log.info('cache miss', 42, { ok: true }, [1, 2], null);

    expect(lines[0]!.args).toEqual([{ value: 42 }, { ok: true }, { value: [1, 2] }, { value: null }]);
  });

  it('is printed as itself — the terminal is not where the fact travels', () => {
    const { log } = announced();
    const printed = vi.spyOn(console, 'info').mockImplementation(() => {});

    log.info('cache miss', 42);

    expect(printed.mock.calls[0]).toContain(42);
  });
});
