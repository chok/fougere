/**
 * Where an app's fronds come from — stated, scanned, or both.
 *
 * The PRESENCE of the key is the decision, the way `remotes:` states a topology. Both may
 * arrive: under Nuxt the scan is a BUILD artifact, so an app may own the frond it states
 * and let the build answer for the rest, at no runtime cost.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { frond } from '../src/index.js';
import { hostedBy } from '../src/boot/hosted.js';
import { Fronds } from '../src/scan/Fronds.js';

class Post extends entity({ id: primary(), title: text() }) {}
class Author extends entity({ id: primary(), name: text() }) {}
class PostHandler { list() { return []; } }

const scanFound = (d: ReturnType<typeof frond>) => ({ fronds: Fronds.scanned([d]), diagnostics: [] });

describe('what an app hosts', () => {
  it('takes the stated fronds when no scan is given, and reads no disk', async () => {
    const hosted = await hostedBy({ fronds: [frond('blog', { entities: [Post] })] });

    expect(hosted.fronds.entityNames()).toEqual(['post']);
    // Nothing ran, so there is nothing a run could have failed to do.
    expect(hosted.diagnostics).toEqual([]);
  });

  it('hands back what a scanner found, diagnostics and all, when nothing is stated', async () => {
    const failed = { severity: 'blocking' as const, code: 'handler-parse-failed', filePath: '/x.ts', message: 'no' };

    const hosted = await hostedBy({ scan: { fronds: Fronds.scanned([]), diagnostics: [failed] } });

    expect(hosted.diagnostics).toEqual([failed]);
  });

  it('refuses a boot that states nothing and scans nothing, naming both doors', async () => {
    await expect(hostedBy({})).rejects.toThrow(/`fronds:`.*`scan:`/s);
  });

  it('lets the statement win over what the scan found under the same name', async () => {
    // The scan found two entities; the app named one. Naming one IS deciding.
    const hosted = await hostedBy({
      fronds: [frond('blog', { entities: [Post] })],
      scan: scanFound(frond('blog', { entities: [Post, Author] })),
    });

    expect(hosted.fronds.entityNames()).toEqual(['post']);
  });

  it('fills a member the statement left unnamed', async () => {
    const hosted = await hostedBy({
      fronds: [frond('blog', { entities: [Post] })],
      scan: scanFound(frond('blog', { entities: [Author], handlers: [PostHandler] })),
    });

    // `entities` was named, so it stands; `handlers` was not, so the scan's answer lands.
    expect(hosted.fronds.entityNames()).toEqual(['post']);
    expect(hosted.fronds[0]!.handlers.map((h) => h.address)).toEqual(['post']);
  });

  it('keeps a scanned frond the statement never mentioned', async () => {
    const hosted = await hostedBy({
      fronds: [frond('blog', { entities: [Post] })],
      scan: scanFound(frond('user', { entities: [Author] })),
    });

    expect(hosted.fronds.map((f) => f.name)).toEqual(['blog', 'user']);
  });
});
