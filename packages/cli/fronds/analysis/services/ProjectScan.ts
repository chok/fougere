import { type FougereConfig, type ScanResult } from '@fougere/core';
import { scanProject } from '@fougere/compiler';
import { nested, resolveConventions } from '@fougere/core';
import { frondAliases, setModuleLoader, loadConfig } from '@fougere/core/node';
import { resolve } from 'node:path';

/** Read a target project without booting it — what every analysis command needs first. */
export default class ProjectScan {
  private cwd = process.cwd();

  /** Scan the project at `root`, relative to where the command was invoked. */
  async at(root?: string): Promise<ScanResult & { root: string; config: FougereConfig }> {
    const target = resolve(this.cwd, root || '.');

    const { createJiti } = await import('jiti');
    const install = (alias?: Record<string, string>): void => {
      const jiti = createJiti(import.meta.url, { interopDefault: true, ...(alias ? { alias } : {}) });
      setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);
    };

    install();
    const config = await loadConfig(target);
    const conventions = resolveConventions(config.conventions);

    install(await frondAliases(target, conventions));

    const scanned = await scanProject(target, undefined, conventions);

    return { config, ...scanned, fronds: nested(scanned.fronds, config.fronds) };
  }
}
