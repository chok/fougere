import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This CLI's version — found by walking up to its manifest, since `src/` and `dist/src/` sit at different depths. */
export function version(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir);

  return (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string }).version;
}
