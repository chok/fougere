/**
 * The CLI's own `fougere build`, before there is a CLI to run it: the same operation, loaded.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { interopDefault: true });

const { default: ProjectScan } = await jiti.import<{ default: new () => object }>('../fronds/analysis/services/ProjectScan.ts');
const { default: BuildHandler } = await jiti.import<{ default: new (scan: object) => { execute(input: { root: string }): Promise<unknown> } }>(
  '../fronds/analysis/handlers/BuildHandler.ts',
);

await new BuildHandler(new ProjectScan()).execute({ root });
