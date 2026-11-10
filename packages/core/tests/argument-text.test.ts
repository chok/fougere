import { describe, it, expect } from 'vitest';
import { argumentText } from '../src/builtin/LogRecord.js';

describe('an argument of a log line, as text', () => {
  it.each([
    ['a string as it is', 'ready', 'ready'],
    ['an error by its name and message', new TypeError('bad'), 'TypeError: bad'],
    ['a value as JSON', { id: 1 }, '{"id":1}'],
    ['what JSON leaves out as itself', undefined, 'undefined'],
  ])('writes %s', (_, value, text) => {
    expect(argumentText(value)).toBe(text);
  });

  it('writes a value JSON cannot hold as itself', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    expect(argumentText(cycle)).toBe('[object Object]');
  });
});
