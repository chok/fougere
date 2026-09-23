/**
 * How much a caller may send is the config's, held once for the process and consulted at every
 * door — so a re-read moves it, like the log level.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { applyConfig } from '../src/boot/apply.js';
import { ENVELOPE_BYTES, maxBodyBytes, maxFrameBytes, setMaxBodyBytes } from '../src/wire/BodyLimit.js';

const DEFAULT_LIMIT = maxBodyBytes();

afterEach(() => setMaxBodyBytes(DEFAULT_LIMIT));

describe('maxBodyBytes', () => {
  it('is 2 MiB when the config says nothing', () => {
    expect(DEFAULT_LIMIT).toBe(2 * 1024 * 1024);
  });

  it('is set by the config, and a hop keeps the envelope\'s room above it', () => {
    const out = applyConfig({ maxBodyBytes: 3 * 1024 * 1024 });

    expect(maxBodyBytes()).toBe(3 * 1024 * 1024);
    expect(maxFrameBytes()).toBe(3 * 1024 * 1024 + ENVELOPE_BYTES);
    expect(out.applied).toContain(`maxBodyBytes: ${DEFAULT_LIMIT} → ${3 * 1024 * 1024}`);
  });

  it('moves on a re-read rather than waiting for a restart', () => {
    const out = applyConfig({ maxBodyBytes: 4096 }, { maxBodyBytes: 8192 });

    expect(out.pending).not.toContain('maxBodyBytes');
    expect(maxBodyBytes()).toBe(4096);
  });

  it('refuses what is not a positive whole number of bytes', () => {
    expect(() => applyConfig({ maxBodyBytes: 0 })).toThrow('maxBodyBytes: a positive whole number of bytes');
    expect(() => setMaxBodyBytes(1.5)).toThrow();
  });
});
