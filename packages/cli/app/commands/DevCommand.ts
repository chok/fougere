import { resolve } from 'node:path';
import { REMOTES } from '@fougere/core/node';
import ServeCommand, { type Hosting } from './ServeCommand.js';
import { installLoader } from '../../src/loader.js';

/**
 * `fougere serve` from the sources: transpiled as they load, and booted again when one changes —
 * the dev loop, where a frond created a second ago resolves at its first import.
 */
export default class DevCommand extends ServeCommand {
  static override built = false;
  protected override verb = 'dev';

  protected override async hosting(root: string, frond: string): Promise<Hosting> {
    // Cache-free from the FIRST boot, so every boot in this process reads the same way rather
    // than the first one being special.
    const conventions = await installLoader(root, true);
    const { bootApp } = await import('@fougere/defaults');

    // The directories, not the fronds booted: a frond created while this runs is in them too.
    return { boot: () => bootApp(root, { only: [frond] }), watched: [resolve(root, conventions.fronds), resolve(root, REMOTES)] };
  }
}
