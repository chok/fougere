/**
 * Sync remote frond schemas — equivalent to `fougere sync blog --from http://localhost:4001`
 *
 * Fetches entity metadata from the remote server and generates
 * local Entity files that can be imported as @fronds/blog.
 *
 * Run: npx tsx sync-remote.ts
 * Requires: remote-blog server running on port 4001
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SchemaDescriptor } from '@fougere/schema';

const REMOTE_URL = process.env.REMOTE_URL ?? 'http://localhost:4001';
const CWD = import.meta.dirname;

/**
 * The identity card a host serves on `rpc.discover` — two lists per frond, and they are
 * duals: what you may CALL, and what you will RECEIVE. Both carry a shape when there is
 * one; a door may store nothing and a fact may announce a type that is not an entity.
 */
interface IdentityCard {
  fronds: Array<{
    name: string;
    doors: Array<{ name: string; ops: Array<{ name: string }>; schema?: SchemaDescriptor }>;
    facts?: Array<{ name: string; schema?: SchemaDescriptor }>;
  }>;
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

async function sync() {
  console.log(`Syncing from ${REMOTE_URL}/_fougere/call (rpc.discover) ...`);

  // The envelope every consumer already speaks — no side endpoint. It answers
  // with what the host SERVES: an entity with no façade is absent, so a synced
  // schema always has something to call on it.
  const res = await fetch(`${REMOTE_URL}/_fougere/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc.discover', params: { params: {}, query: {}, state: {} } }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);

  const rpc = (await res.json()) as { result?: IdentityCard; error?: { message: string } };
  if (rpc.error) throw new Error(`Remote error: ${rpc.error.message}`);

  for (const frond of rpc.result!.fronds) {
    const frondDir = join(CWD, '.fougere', 'remotes', frond.name);
    const entitiesDir = join(frondDir, 'entities');
    mkdirSync(entitiesDir, { recursive: true });

    const entityNames: string[] = [];

    // Doors and facts alike: both give a class when they carry a shape. A door with none
    // is a health check or a search across shapes; a fact with none announces a type the
    // host does not store. Neither produces a file.
    const shaped = [...frond.doors, ...(frond.facts ?? [])]
      .flatMap(({ schema }) => (schema ? [schema] : []));

    for (const descriptor of shaped) {
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
      console.log(`  Generated ${frond.name}/entities/${className}.ts`);
    }

    // Barrel index
    const indexLines = entityNames.map(
      (name) => `export { default as ${name} } from './entities/${name}.js';`,
    );
    writeFileSync(join(frondDir, 'index.ts'), indexLines.join('\n') + '\n');

    // Package.json
    writeFileSync(join(frondDir, 'package.json'), JSON.stringify({
      name: `@fronds/${frond.name}`,
      version: '0.0.0-synced',
      type: 'module',
      fougere: { frond: frond.name, synced: true, source: REMOTE_URL },
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
  for (const frond of rpc.result!.fronds) {
    registry[frond.name] = {
      url: REMOTE_URL,
      path: join(CWD, '.fougere', 'remotes', frond.name),
    };
  }
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

  console.log('Done. Remote schemas synced to .fougere/remotes/');
}

sync().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
