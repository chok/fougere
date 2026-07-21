import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SchemaDescriptor } from '@fougere/schema';

interface IdentityCard {
  fronds: Array<{ name: string; entities: Array<{ name: string; ops: string[]; schema: SchemaDescriptor }> }>;
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

export default class SyncHandler {
  // cwd is ambient in a CLI — not a DI service (the container resolves by type).
  private cwd = process.cwd();

  async execute(input: { name: string; from: string }): Promise<{ path: string; entities: string[] }> {
    const baseUrl = input.from.replace(/\/$/, '');

    // The served frond answers `rpc.discover` on its call endpoint with its
    // identity card — the same surface every consumer reads, no side endpoint.
    const res = await fetch(`${baseUrl}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc.discover', params: { params: {}, query: {}, state: {} } }),
    });
    if (!res.ok) {
      throw new Error(`Failed to reach ${baseUrl}/_fougere/call: ${res.status} ${res.statusText}`);
    }
    const rpc = (await res.json()) as { result?: IdentityCard; error?: { message: string } };
    if (rpc.error) throw new Error(`Remote error: ${rpc.error.message}`);
    const card = rpc.result!;

    const target = card.fronds.find((f) => f.name === input.name);
    if (!target) {
      throw new Error(`Frond '${input.name}' not found on ${baseUrl}. Available: ${card.fronds.map((f) => f.name).join(', ')}`);
    }

    const frondDir = join(this.cwd, '.fougere', 'remotes', input.name);
    const entitiesDir = join(frondDir, 'entities');
    mkdirSync(entitiesDir, { recursive: true });

    const entityNames: string[] = [];

    for (const { schema: descriptor } of target.entities) {
      const className = capitalize(descriptor.title ?? 'Entity');
      entityNames.push(className);

      const cardJson = JSON.stringify(descriptor, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : '  ' + line))
        .join('\n');

      // One call rebuilds a working schema (validate/from) from the portable card.
      const code = [
        `import { reconstruct } from '@fougere/schema';`,
        ``,
        `const ${className} = reconstruct(${cardJson});`,
        `export default ${className};`,
        ``,
      ].join('\n');

      writeFileSync(join(entitiesDir, `${className}.ts`), code);
    }

    // Barrel index
    const indexLines = entityNames.map(
      (name) => `export { default as ${name} } from './entities/${name}.js';`,
    );
    writeFileSync(join(frondDir, 'index.ts'), indexLines.join('\n') + '\n');

    // Package.json
    writeFileSync(join(frondDir, 'package.json'), JSON.stringify({
      name: `@frond/${input.name}`,
      version: '0.0.0-synced',
      type: 'module',
      fougere: { frond: input.name, synced: true, source: baseUrl },
      exports: {
        '.': './index.ts',
        './entities/*': './entities/*.ts',
        './package.json': './package.json',
      },
    }, null, 2) + '\n');

    // Update .fougere/remotes.json — central registry of synced remotes
    this.updateRemotesRegistry(input.name, baseUrl, frondDir);

    // Update tsconfig paths if tsconfig.json exists (non-Nuxt projects)
    this.updateTsconfigPaths(input.name, frondDir);

    return { path: entitiesDir, entities: entityNames };
  }

  /** Write/update .fougere/remotes.json — read by @fougere/nuxt for auto-aliasing. */
  private updateRemotesRegistry(name: string, baseUrl: string, localPath: string): void {
    const registryPath = join(this.cwd, '.fougere', 'remotes.json');
    let registry: Record<string, { url: string; path: string }> = {};

    if (existsSync(registryPath)) {
      try { registry = JSON.parse(readFileSync(registryPath, 'utf-8')); } catch { /* corrupt, reset */ }
    }

    registry[name] = { url: baseUrl, path: localPath };
    mkdirSync(join(this.cwd, '.fougere'), { recursive: true });
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  }

  /** Add @frond/{name} to tsconfig paths if tsconfig.json exists. */
  private updateTsconfigPaths(name: string, localPath: string): void {
    const tsconfigPath = join(this.cwd, 'tsconfig.json');
    if (!existsSync(tsconfigPath)) return;

    try {
      const raw = readFileSync(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(raw);

      // Don't touch Nuxt-managed tsconfigs (extends .nuxt/tsconfig.json)
      if (tsconfig.extends?.includes('.nuxt/')) return;

      tsconfig.compilerOptions ??= {};
      tsconfig.compilerOptions.paths ??= {};

      const relative = localPath.replace(this.cwd, '.').replace(/\\/g, '/');
      tsconfig.compilerOptions.paths[`@frond/${name}`] = [`${relative}/index.ts`];
      tsconfig.compilerOptions.paths[`@frond/${name}/*`] = [`${relative}/*`];

      writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
    } catch { /* tsconfig parse error — skip */ }
  }
}
