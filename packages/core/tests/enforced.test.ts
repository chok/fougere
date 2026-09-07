/**
 * What the place rows live in keeps, and what it only appears to.
 *
 * `unique()` reads as one promise wherever it is declared, and it is not one. The judge at the
 * door refuses a duplicate it can SEE — a row already stored. Two writes arriving together see
 * the same absence, and only the place they land can refuse the second. SQL does, a Map does
 * not, and until now nothing said so.
 */
import { describe, it, expect, vi } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, frond, type Constraint } from '../src/index.js';

class Bike extends entity({ id: primary(), plate: text() }, { unique: [['plate']] }) {}
class Ride extends entity({ id: primary(), bikeId: text(), day: text() }, { unique: [['bikeId', 'day']] }) {}
class Rider extends entity({ id: primary(), name: text() }) {}

const storageFactory = () => ({}) as never;

const booting = async (enforces?: (source: string, constraint: Constraint) => boolean): Promise<string[]> => {
  const lines: string[] = [];
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method)
      .mockImplementation((...said: unknown[]) => { lines.push(said.join(' ')); }));

  const app = await createApp({
    createContainer,
    storageFactory,
    enforces,
    fronds: [frond('rental', { entities: [Bike, Ride, Rider] })],
  });
  await app.dispose();
  for (const spy of spies) spy.mockRestore();

  return lines;
};

const warned = (lines: string[]) => lines.filter((line) => line.includes('unique declared'));

describe('a constraint the source does not keep', () => {
  it('names the entities that declared one, on the field and on the group alike', async () => {
    const said = warned(await booting(() => false));

    expect(said).toHaveLength(1);
    expect(said[0]).toContain("bike in 'db'");
    expect(said[0]).toContain("ride in 'db'");
    expect(said[0]).toContain('two concurrent writes can both pass');
  });

  it('leaves out the entity that declared none', async () => {
    expect(warned(await booting(() => false))[0]).not.toContain('rider');
  });

  it('says nothing when the source keeps it', async () => {
    expect(warned(await booting(() => true))).toHaveLength(0);
  });

  it('says nothing when no one can answer, rather than assuming the worst', async () => {
    expect(warned(await booting())).toHaveLength(0);
  });
});
