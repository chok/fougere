import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadConfig, resolveConventions, frondPackage } from '@fougere/core/node';

export default class BuildFrondHandler {
  // cwd is ambient in a CLI — not a DI service (the container resolves by type).
  private cwd = process.cwd();

  /** Build a frond into a standalone deployable package. */
  async execute(input: { name: string }): Promise<{ path: string; entities: string[] }> {
    const conventions = resolveConventions((await loadConfig(this.cwd)).conventions);
    const frondDir = join(this.cwd, conventions.fronds, input.name);

    if (!existsSync(frondDir)) {
      throw new Error(`Frond '${input.name}' not found at ${frondDir}`);
    }

    const entitiesDir = join(frondDir, conventions.dirs.entities);
    if (!existsSync(entitiesDir)) {
      throw new Error(`No ${conventions.dirs.entities}/ directory in frond '${input.name}'`);
    }

    // Discover entity files
    const entityFiles = readdirSync(entitiesDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
      .sort();

    if (entityFiles.length === 0) {
      throw new Error(`No .ts files in ${entitiesDir}`);
    }

    const entityNames = entityFiles.map((f) => basename(f, '.ts'));

    // Generate barrel index.ts
    const indexLines = entityNames.map(
      (name) => `export { default as ${name} } from './${conventions.dirs.entities}/${name}.js';`,
    );
    writeFileSync(join(frondDir, 'index.ts'), indexLines.join('\n') + '\n');

    // Generate tsconfig.build.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'Node16',
        moduleResolution: 'Node16',
        declaration: true,
        outDir: './dist',
        rootDir: '.',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ['index.ts', `${conventions.dirs.entities}/**/*.ts`],
    };

    const tsconfigPath = join(frondDir, 'tsconfig.build.json');
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

    try {
      execSync('npx tsc -p tsconfig.build.json', { cwd: frondDir, stdio: 'inherit' });
    } finally {
      try { unlinkSync(tsconfigPath); } catch { /* ignore */ }
    }

    // Update package.json
    const pkgPath = join(frondDir, 'package.json');
    const pkg = existsSync(pkgPath)
      ? JSON.parse(readFileSync(pkgPath, 'utf-8'))
      : { name: frondPackage(input.name, conventions), version: '0.0.1', type: 'module' };

    pkg.exports = {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
      [`./${conventions.dirs.entities}/*`]: {
        types: `./dist/${conventions.dirs.entities}/*.d.ts`,
        default: `./dist/${conventions.dirs.entities}/*.js`,
      },
      './package.json': './package.json',
    };

    // Only publish dist + package.json
    pkg.files = ['dist', 'package.json'];

    // Ensure peerDependencies on @fougere/schema
    pkg.peerDependencies ??= {};
    pkg.peerDependencies['@fougere/schema'] ??= '*';

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    return { path: join(frondDir, 'dist'), entities: entityNames };
  }
}
