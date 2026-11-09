import { resolve } from 'node:path';
import { REMOTES } from '@fougere/core/node';
import ServeCommand, { type Hosting } from './ServeCommand.js';
import { installLoader } from '../../src/loader.js';

/** `fougere serve` from the sources, booted again when one changes. */
export default class DevCommand extends ServeCommand {
  static override built = false;
  protected override verb = 'dev';

  protected override async hosting(root: string, frond: string): Promise<Hosting> {
    const conventions = await installLoader(root, true);
    const { bootApp } = await import('@fougere/defaults');

    return { boot: () => bootApp(root, { only: [frond] }), watched: [resolve(root, conventions.fronds), resolve(root, REMOTES)] };
  }
}
