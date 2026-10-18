/**
 * A term an entity names is answered by the process, or the boot refuses — not the first value
 * judged, which used to answer a 500.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text, StringFormats } from '@fougere/schema';
import { createApp, frond } from '../src/index.js';

class Shelf extends entity({ id: primary(), mark: text({ format: 'shelfmark' }) }) {}

const boot = (vocabulary = [] as ReturnType<typeof StringFormats.term>[]) => createApp({
  createContainer,
  storageFactory: () => ({}) as never,
  fronds: [frond('library', { entities: [Shelf] })],
  vocabulary,
});

describe('the terms an entity names', () => {
  it('refuses the boot when nothing answers one, naming the field and the term', async () => {
    await expect(boot()).rejects.toThrow(/Shelf\.mark names the format 'shelfmark'/);
  });

  it('boots once the process lists it', async () => {
    const shelfmark = StringFormats.term('shelfmark', (value) => /^[A-Z]\d+$/.test(value));
    await using app = await boot([shelfmark]);

    expect(app.fronds.map((one) => one.name)).toEqual(['library']);
  });
});
