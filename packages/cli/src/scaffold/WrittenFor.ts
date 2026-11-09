import { detect } from 'package-manager-detector/detect';
import { PackageManager } from './PackageManager.js';

/**
 * The package manager a project is written for, from the flag, the launcher, then the project around; `undefined` when nothing says.
 *
 * Documented: [the CLI](https://fougere.dev/reference/cli#which-package-manager).
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
