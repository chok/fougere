import { detect } from 'package-manager-detector/detect';
import { PackageManager } from './PackageManager.js';

/**
 * The package manager a project is written for, from what is known before anyone is asked: what the
 * command stated, who launched it (`npm create`, `pnpx`, `bunx`, `yarn dlx`), then the project the new
 * one is created inside — its lockfile or its `packageManager`. Nothing known answers `undefined`, for
 * the caller to ask or to say it chose npm.
 *
 * Documented: [the CLI](https://fougere.dev/docs/cli#which-package-manager).
 */
export async function writtenFor(stated: string | undefined, cwd: string, agent = process.env.npm_config_user_agent): Promise<PackageManager | undefined> {
  if (stated) {
    const name = PackageManager.names.find((candidate) => candidate === stated);
    if (!name) throw new Error(`'${stated}' is not a package manager Fougere writes for: ${PackageManager.names.join(', ')}.`);

    return new PackageManager(name);
  }
  if (agent) return PackageManager.of(agent);

  const around = await detect({ cwd });

  return around ? PackageManager.of(`${around.name}/${around.version ?? ''}`) : undefined;
}
