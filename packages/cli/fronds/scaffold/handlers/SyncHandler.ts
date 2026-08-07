import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { entitySourceOf, facadeTypeSourceOf, type SchemaDescriptor } from '@fougere/schema';
// The card's shape is declared once, in core, and imported here. A private copy of it
// lived in this file and went stale the day an op stopped being a bare name: nothing
// compared the copy to the original, so the drift cost nothing until someone read it.
import type { IdentityCard } from '@fougere/core';

function assertSafeName(kind: string, name: string): void {
  if (typeof name !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(name)) {
    throw new Error(`Invalid ${kind} name '${name}' received from remote`);
  }
}

export function entityClassName(name: string): string {
  assertSafeName('entity', name);
  const identifier = name
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(identifier)) {
    throw new Error(`Entity name '${name}' cannot be represented as a TypeScript identifier`);
  }
  return identifier;
}

function identityCardOf(value: unknown): IdentityCard {
  if (!value || typeof value !== 'object' || !Array.isArray((value as IdentityCard).fronds)) {
    throw new Error('Remote rpc.discover returned an invalid identity card');
  }
  const card = value as IdentityCard;
  for (const frond of card.fronds) {
    if (!frond || typeof frond !== 'object') {
      throw new Error('Remote rpc.discover returned an invalid frond entry');
    }
    assertSafeName('frond', frond.name);
    if (!Array.isArray(frond.entities)) {
      throw new Error(`Remote frond '${frond.name}' has no valid entities array`);
    }
    for (const entity of frond.entities) {
      if (!entity || typeof entity !== 'object') {
        throw new Error(`Remote frond '${frond.name}' contains an invalid entity entry`);
      }
      assertSafeName('entity', entity.name);
      // `ops` is not checked because it is not used: sync writes entities, and the name
      // and the descriptor below are the only two values that reach a file. The clause
      // that stood here demanded strings — the shape ops had before they carried their
      // kind and their views — and so refused every real host. Judge what you consume.
      const descriptor = entity.schema as unknown;
      if (
        !descriptor
        || typeof descriptor !== 'object'
        || Array.isArray(descriptor)
        || (descriptor as SchemaDescriptor).type !== 'object'
        || !(descriptor as SchemaDescriptor).properties
        || typeof (descriptor as SchemaDescriptor).properties !== 'object'
        || Array.isArray((descriptor as SchemaDescriptor).properties)
        || (descriptor as SchemaDescriptor)['x-fougere-version'] !== 1
        || (descriptor as SchemaDescriptor)['x-fougere-vendor'] !== 'fougere'
      ) {
        throw new Error(`Remote entity '${entity.name}' has no valid schema descriptor`);
      }
    }
  }
  return card;
}

export default class SyncHandler {
  // cwd is ambient in a CLI — not a DI service (the container resolves by type).
  private cwd = process.cwd();

  /** Mirror a remote frond's contract into local entities. */
  async execute(input: { name: string; from: string }): Promise<{ path: string; entities: string[] }> {
    assertSafeName('frond', input.name);
    let remoteUrl: URL;
    try {
      remoteUrl = new URL(input.from);
    } catch {
      throw new Error(`Invalid remote URL '${input.from}'`);
    }
    if (remoteUrl.protocol !== 'http:' && remoteUrl.protocol !== 'https:') {
      throw new Error(`Remote URL must use http or https, got '${remoteUrl.protocol}'`);
    }
    const baseUrl = remoteUrl.toString().replace(/\/$/, '');

    // The served frond answers `rpc.discover` on its call endpoint with its
    // identity card — the same surface every consumer reads, no side endpoint.
    const res = await fetch(`${baseUrl}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc.discover', params: { params: {}, query: {}, state: {} } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Failed to reach ${baseUrl}/_fougere/call: ${res.status} ${res.statusText}`);
    }
    const rpc = (await res.json()) as { result?: IdentityCard; error?: { message: string } };
    if (rpc.error) throw new Error(`Remote error: ${rpc.error.message}`);
    const card = identityCardOf(rpc.result);

    const target = card.fronds.find((f) => f.name === input.name);
    if (!target) {
      throw new Error(`Frond '${input.name}' not found on ${baseUrl}. Available: ${card.fronds.map((f) => f.name).join(', ')}`);
    }

    const frondDir = join(this.cwd, '.fougere', 'remotes', input.name);
    const entitiesDir = join(frondDir, 'entities');
    const handlersDir = join(frondDir, 'handlers');
    mkdirSync(entitiesDir, { recursive: true });
    mkdirSync(handlersDir, { recursive: true });

    const entityNames: string[] = [];

    const seen = new Set<string>();
    for (const { name, schema: descriptor, ops } of target.entities) {
      const className = entityClassName(name);
      if (seen.has(className)) throw new Error(`Remote declares duplicate entity '${className}'`);
      seen.add(className);
      entityNames.push(className);

      /**
       * One card, one class.
       *
       * `reconstruct` gives the JUDGE — validate, from, getFields — and now takes the
       * row shape as a type argument, so the same declaration gives the TYPE. Both
       * come off the same card: nothing to keep in step, and the file a consumer reads
       * has the shape of the one they would have written by hand
       * (`class Post extends entity({…}) {}`).
       */
      const code = [
        `import { reconstruct } from '@fougere/schema';`,
        ``,
        `// Generated by \`fougere sync\` from ${baseUrl} — do not edit.`,
        entitySourceOf(descriptor as SchemaDescriptor, { name: className }),
        ``,
        `export default ${className};`,
        ``,
      ].join('\n');

      writeFileSync(join(entitiesDir, `${className}.ts`), code);

      /**
       * The door's type, next to the row's — what `Facade<T>` needs and what nothing
       * carried across a repository boundary.
       *
       * Writing `Facade<ArticleHandler>` used to require importing the handler's class.
       * `sync` does not ship handlers and should not: a handler is behaviour with state,
       * and behaviour does not travel. Its OPERATIONS do — the card names them, says how
       * much each returns, and that is exactly a signature.
       */
      const facadeSource = facadeTypeSourceOf(ops ?? [], {
        name: `${className}Handler`,
        rowType: className,
      });
      writeFileSync(join(handlersDir, `${className}Handler.ts`), [
        `import type { ${className} } from '../entities/${className}.js';`,
        ``,
        `// Generated by \`fougere sync\` from ${baseUrl} — do not edit.`,
        `// The shape of an invocation, restated rather than imported: this file is a`,
        `// contract, and a contract that drags a runtime dependency is not one.`,
        `type Invocation = { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown; state?: Record<string, unknown> };`,
        ``,
        facadeSource,
        ``,
      ].join('\n'));
    }

    // Barrel index
    // One binding carries the value AND the type, because a class is both — the pair of
    // re-exports that stood here was the price of declaring them separately.
    const indexLines = entityNames.flatMap((name) => [
      `export { default as ${name} } from './entities/${name}.js';`,
      `export type { ${name}Handler } from './handlers/${name}Handler.js';`,
    ]);
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
        './handlers/*': './handlers/*.ts',
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
      try {
        const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf-8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected an object');
        registry = parsed as Record<string, { url: string; path: string }>;
      } catch (cause) {
        throw new Error(`Cannot update corrupt remote registry at ${registryPath}`, { cause });
      }
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
