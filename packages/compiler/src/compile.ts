/** The project as JavaScript — what `fougere serve` starts with Node alone. */
import { loadTS } from './scan/TypeProgram.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { resolveConventions, statesModule, type ScanResult } from '@fougere/core';
import { ALIASES, configFileIn, frondAliases, loadConfig, MODULES, appOptionsFileIn } from '@fougere/core/node';
import { emitAppOptions } from './scan/appOptions.js';

export interface Compiled {
  out: string;
  /** Each file written, relative to `out`. */
  files: string[];
}

/** Transpiles the files the config and the statement reach into `out`, at the paths they had under `root`. */
export async function compileProject(root: string, scan: ScanResult, out: string): Promise<Compiled> {
  const typescript = await loadTS();
  const config = await loadConfig(root);
  const aliases = await frondAliases(root, resolveConventions(config.conventions));
  const statement = appOptionsFileIn(root) ?? join(root, 'fronds.ts');
  const sources = new Map<string, string>();
  if (!existsSync(statement)) sources.set(statement, emitAppOptions(scan, { outFile: statement }));

  const keys = Object.keys(config.fronds ?? {}).filter(statesModule);
  const local = keys.filter((key) => key.startsWith('.')).map((key) => resolve(root, key));
  const pending = [configFileIn(root), statement, ...local].filter((path): path is string => path !== undefined);
  const reached = new Set<string>();
  while (pending.length) {
    const file = pending.pop()!;
    if (reached.has(file)) continue;
    reached.add(file);
    const text = sources.get(file) ?? readFileSync(file, 'utf8');
    sources.set(file, text);
    for (const { fileName: specifier } of typescript.preProcessFile(text, true, true).importedFiles) {
      const target = localFileOf(specifier, file, aliases);
      if (target && !relative(root, target).startsWith('..')) pending.push(target);
    }
  }

  const files: string[] = [];
  for (const [file, text] of sources) {
    const { outputText } = typescript.transpileModule(text, {
      fileName: file,
      compilerOptions: {
        module: typescript.ModuleKind.ESNext,
        target: typescript.ScriptTarget.ES2022,
        rewriteRelativeImportExtensions: true,
      },
    });
    const path = relative(root, file).replace(/\.(m?)ts$/, '.$1js');
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), outputText);
    files.push(path);
  }

  const table = Object.fromEntries(Object.entries(aliases).map(([alias, dir]) => [alias, relative(root, dir)]));
  writeFileSync(join(out, ALIASES), JSON.stringify(table, null, 2) + '\n');
  const specifierOf = (key: string) => (key.startsWith('.') ? `./${relative(root, resolve(root, key)).replace(/\.(m?)ts$/, '.$1js')}` : key);
  const imports = keys.map((key) => `  ${JSON.stringify(key)}: () => import(${JSON.stringify(specifierOf(key))}),`);
  writeFileSync(join(out, MODULES), ['export default {', ...imports, '};', ''].join('\n'));

  return { out, files: files.sort() };
}

function localFileOf(specifier: string, from: string, aliases: Record<string, string>): string | undefined {
  const alias = Object.keys(aliases).sort((left, right) => right.length - left.length)
    .find((name) => specifier === name || specifier.startsWith(`${name}/`));
  const base = specifier.startsWith('.')
    ? resolve(dirname(from), specifier)
    : alias ? aliases[alias] + specifier.slice(alias.length) : undefined;
  if (!base) return undefined;

  return [base, base.replace(/\.js$/, '.ts'), base.replace(/\.mjs$/, '.mts'), `${base}.ts`, join(base, 'index.ts')]
    .find((candidate) => candidate.endsWith('ts') && existsSync(candidate)) ?? (existsSync(base) ? base : undefined);
}
