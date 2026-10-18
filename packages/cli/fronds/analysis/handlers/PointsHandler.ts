import type { Plugged } from '@fougere/core';
import ProjectScan from '../services/ProjectScan.js';
import type Points from '../entities/Points.js';

export default class PointsHandler {
  constructor(private projectScan: ProjectScan) {}

  /**
   * What answers each extension point, read off the app as its host would boot it — with the
   * schema check and the seeds left out, so reading it touches no row.
   */
  async execute(input: Omit<Points, 'json'>): Promise<readonly Plugged[]> {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const { bootApp } = await import('@fougere/defaults');
    const app = await bootApp(scan.root, { extensions: [{ name: 'schema' }, { name: 'seeds' }] });
    try {
      return app.extensionPoints();
    } finally {
      await app.dispose();
    }
  }
}
