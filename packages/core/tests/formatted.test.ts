/**
 * `formatted` prints a line the logger wrote and a line read back as a fact the same way — the
 * first stamps `at` in epoch milliseconds, the second carries the `Date` announcing filled in.
 */
import { describe, it, expect } from 'vitest';
import { formatted, LogLine, type LogRecord } from '../src/index.js';

const at = Date.UTC(2026, 9, 22, 21, 5, 9);

const record: LogRecord = {
  level: 'warn',
  name: 'app:blog',
  message: 'slow query',
  args: [{ ms: 412 }],
  during: 'blog:PostHandler.publish',
  at,
};

describe('formatted', () => {
  it('prints a record without colour: badge, name, operation, message, arguments', () => {
    const { method, text } = formatted(record, false);

    expect(method).toBe('warn');
    expect(text.slice(1)).toEqual(['slow query', { ms: 412 }]);
    expect(String(text[0])).toMatch(/ WRN \[app:blog\] \(blog:PostHandler\.publish\)$/);
  });

  it('prints a line read back as a fact exactly as the record it came from', () => {
    const line = new LogLine({ ...record, at: new Date(at) });

    expect(formatted(line, false)).toEqual(formatted(record, false));
  });

  it('leaves the operation out when the line carries none, and the arguments when it has none', () => {
    const { text } = formatted({ level: 'info', name: 'app', message: 'ready', at }, false);

    expect(String(text[0])).toMatch(/ INF \[app\]$/);
    expect(text.slice(1)).toEqual(['ready']);
  });
});
