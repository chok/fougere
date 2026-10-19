/**
 * How much a caller may send is the config's, held once for the process and consulted at every
 * door — so a re-read moves it, like the log level.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { applyConfig } from '../src/boot/apply.js';
import { Readable } from 'node:stream';
import { ENVELOPE_BYTES, maxBodyBytes, maxFrameBytes, readWithin, setMaxBodyBytes } from '../src/wire/BodyLimit.js';

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
    expect(() => applyConfig({ maxBodyBytes: 0 })).toThrow('maxBodyBytes must be a positive whole number of bytes');
    expect(() => setMaxBodyBytes(1.5)).toThrow();
  });
});

describe('readWithin', () => {
  const stream = (...parts: string[]) => new Response(parts.join('')).body;

  it('reads a Web stream and a Node request the same', async () => {
    expect(await readWithin(stream('{"a":', '1}'), 100)).toBe('{"a":1}');
    expect(await readWithin(Readable.from([Buffer.from('{"a":'), Buffer.from('1}')]), 100)).toBe('{"a":1}');
  });

  it('refuses on the length a body declares, before reading it', async () => {
    let read = false;
    const body = new ReadableStream<Uint8Array>({ pull: () => { read = true; } }, { highWaterMark: 0 });

    await expect(readWithin(body, 10, '11')).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(read).toBe(false);
  });

  it('refuses while counting, when the declared length lies or is absent', async () => {
    await expect(readWithin(stream('x'.repeat(11)), 10, '3')).rejects.toThrow(/larger than 10 bytes/);
    await expect(readWithin(Readable.from([Buffer.from('x'.repeat(11))]), 10)).rejects.toThrow(/larger than 10 bytes/);
  });

  it('reads no body as empty', async () => {
    expect(await readWithin(null, 10)).toBe('');
  });
});
