/** `fougere points` — what answers each extension point, read off the app as its host boots it. */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import PointsHandler from '../fronds/analysis/handlers/PointsHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';

const fixture = join(import.meta.dirname, 'fixtures-points');

describe('fougere points', () => {
  it('names the provider behind a port and the registries', async () => {
    const points = await new PointsHandler(new ProjectScan()).execute({ root: fixture });

    expect(points).toContainEqual({ point: 'Payment', by: 'type', frond: 'billing', answers: ['StripePayment'] });
    expect(points).toContainEqual(expect.objectContaining({ point: 'source type', by: 'name' }));
  }, 30_000);
});
