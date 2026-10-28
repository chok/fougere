/**
 * A port with a subject — `Gate<NoteHandler>` — is that subject's: a constructor asking for it, a class
 * extending it and one implementing it all name the key `Gate<NoteHandler>`, which no class name can
 * hold. The prototype reads `Gate` alone, so the scan states it whole.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/scan/scanner.js';

const root = join(import.meta.dirname, 'fixtures-subject-port');

describe('a port with a subject', () => {
  it('is one key on every side: what a class asks for, extends and implements', async () => {
    const { fronds } = await scanProject(root);
    const desk = fronds.find((frond) => frond.name === 'desk')!;
    const named = (name: string) => desk.providers.find((provider) => provider.name === name)!;

    expect(named('NoteGate')).toMatchObject({ deps: ['Gate<NoteHandler>'], implements: ['Gate<NoteHandler>'] });
    expect(named('WatchGate')).toMatchObject({ deps: ['Gate<NoteHandler>'], implements: ['Gate<NoteHandler>'] });
  }, 30_000);

  it('is how a link stands in front of a collector: Collect<Reader>', async () => {
    const { fronds } = await scanProject(root);
    const desk = fronds.find((frond) => frond.name === 'desk')!;

    expect(desk.providers.find((provider) => provider.name === 'CachedReader')).toMatchObject({ deps: ['Collect<Reader>'], implements: ['Collect<Reader>'] });
    expect(desk.collectors.map((collector) => collector.typeName)).toEqual(['reader']);
  }, 30_000);
});
