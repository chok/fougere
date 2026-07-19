/**
 * Sync remote frond schemas — equivalent to `fougere sync blog --from http://localhost:4001`
 *
 * Fetches entity metadata from the remote server and generates
 * local Entity files that can be imported as @frond/blog.
 *
 * Run: npx tsx sync-remote.ts
 * Requires: remote-blog server running on port 4001
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SchemaDescriptor } from '@fougere/schema';

const REMOTE_URL = process.env.REMOTE_URL ?? 'http://localhost:4001';
const CWD = import.meta.dirname;

interface SchemaResponse {
  frond: string;
  entities: SchemaDescriptor[];
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

async function sync() {
  console.log(`Syncing from ${REMOTE_URL}/_fougere/schema ...`);

  const res = await fetch(`${REMOTE_URL}/_fougere/schema`);
  if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);

  const fronds = (await res.json()) as SchemaResponse[];

  for (const frond of fronds) {
    const frondDir = join(CWD, '.fougere', 'remotes', frond.frond);
    const entitiesDir = join(frondDir, 'entities');
    mkdirSync(entitiesDir, { recursive: true });

    const entityNames: string[] = [];

    for (const descriptor of frond.entities) {
      const className = capitalize(descriptor.title ?? 'Entity');
      entityNames.push(className);

      const cardJson = JSON.stringify(descriptor, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : '  ' + line))
        .join('\n');

      const code = [
        `import { reconstruct } from '@fougere/schema';`,
        ``,
        `const ${className} = reconstruct(${cardJson});`,
        `export default ${className};`,
        ``,
      ].join('\n');

      writeFileSync(join(entitiesDir, `${className}.ts`), code);
      console.log(`  Generated ${frond.frond}/entities/${className}.ts`);
    }

    // Barrel index
    const indexLines = entityNames.map(
      (name) => `export { default as ${name} } from './entities/${name}.js';`,
    );
    writeFileSync(join(frondDir, 'index.ts'), indexLines.join('\n') + '\n');

    // Package.json
    writeFileSync(join(frondDir, 'package.json'), JSON.stringify({
      name: `@frond/${frond.frond}`,
      version: '0.0.0-synced',
      type: 'module',
      fougere: { frond: frond.frond, synced: true, source: REMOTE_URL },
      exports: {
        '.': './index.ts',
        './entities/*': './entities/*.ts',
        './package.json': './package.json',
      },
    }, null, 2) + '\n');
  }

  // Write .fougere/remotes.json — read by @fougere/nuxt for auto-aliasing
  const registryPath = join(CWD, '.fougere', 'remotes.json');
  let registry: Record<string, { url: string; path: string }> = {};
  if (existsSync(registryPath)) {
    try { registry = JSON.parse(readFileSync(registryPath, 'utf-8')); } catch { /* reset */ }
  }
  for (const frond of fronds) {
    registry[frond.frond] = {
      url: REMOTE_URL,
      path: join(CWD, '.fougere', 'remotes', frond.frond),
    };
  }
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

  console.log('Done. Remote schemas synced to .fougere/remotes/');
}

sync().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
