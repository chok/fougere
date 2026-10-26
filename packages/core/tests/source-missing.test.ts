/**
 * Every source lists its rows, so none holds the rest — and an entity left out of all of them
 * has nowhere to live. Kept in memory, it lost its rows at exit beside sources that were declared.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, frond } from '../src/index.js';

class Bike extends entity({ id: primary(), plate: text() }) {}
class Rider extends entity({ id: primary(), name: text() }) {}
class Ride extends entity({ id: primary(), day: text() }) {}

const storageFactory = () => ({}) as never;

const booting = (sourceOf: (entityName: string) => string | undefined) => createApp({
  createContainer,
  storageFactory,
  sourceOf,
  fronds: [frond('rental', { entities: [Bike, Rider, Ride] })],
});

describe('an entity no source holds', () => {
  it('refuses the boot, naming every one left out', async () => {
    const refusal = booting((name) => (name === 'bike' ? 'fleet' : undefined));

    await expect(refusal).rejects.toThrow(/rider lives in no source/);
    await expect(refusal).rejects.toThrow(/ride lives in no source/);
    await expect(refusal).rejects.not.toThrow(/bike lives in no source/);
  });

  it('says the line to write', async () => {
    await expect(booting(() => undefined)).rejects.toThrow(/Add 'bike' to the rows: of one, or give one source no rows: list/);
  });

  it('boots when each one has a source', async () => {
    const app = await booting(() => 'fleet');
    await app.dispose();
  });
});
