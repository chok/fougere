/** The TypeScript program the scan reads through, and the mutable state it keeps. */
import type ts from '@typescript/typescript6';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';

/** Lazy-loaded TypeScript module — avoids bundling the 9MB compiler. */
let _ts: typeof ts | undefined;
export async function loadTS(): Promise<typeof ts> {
  if (!_ts) _ts = (await import('@typescript/typescript6')).default;

  return _ts;
}
export function getTS(): typeof ts {
  if (!_ts) throw new Error('TypeScript not loaded — call an async parse function first');

  return _ts;
}

interface TypeProject {
  roots: Set<string>;
  options: ts.CompilerOptions;
  program: ts.Program;
}

/** One checked program per project/configuration during a scan. */
const typeProjects = new Map<string, TypeProject>();
const compilerProjects = new Map<string, { key: string; roots: string[]; options: ts.CompilerOptions }>();

/** What survives a run. */
const sourceFiles = new Map<string, { mtime: number; file: ts.SourceFile }>();
const retained = new Map<string, { host: ts.CompilerHost; program: ts.Program }>();

export function resetTypePrograms(): void {
  typeProjects.clear();
  compilerProjects.clear();
}

function keptHost(key: string, options: ts.CompilerOptions): ts.CompilerHost {
  const cached = retained.get(key);
  if (cached) return cached.host;
  const typescript = getTS();
  const base = typescript.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...base,
    getSourceFile(fileName, languageVersion, onError, shouldCreate) {
      const path = resolvePath(fileName);
      const mtime = statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? -1;
      const cached = sourceFiles.get(path);
      if (cached && cached.mtime === mtime) return cached.file;
      const file = base.getSourceFile(fileName, languageVersion, onError, shouldCreate);
      if (file && mtime >= 0) sourceFiles.set(path, { mtime, file });

      return file;
    },
  };
  retained.set(key, { host, program: undefined as unknown as ts.Program });

  return host;
}

function builtProgram(key: string, roots: readonly string[], options: ts.CompilerOptions): ts.Program {
  const typescript = getTS();
  const host = keptHost(key, options);
  const program = typescript.createProgram({
    rootNames: [...roots], options, host, oldProgram: retained.get(key)?.program,
  });
  retained.set(key, { host, program });

  return program;
}

function compilerProjectOf(filePath: string, projectRoot?: string): { key: string; roots: string[]; options: ts.CompilerOptions } {
  const typescript = getTS();
  const absolute = resolvePath(filePath);
  const configPath = typescript.findConfigFile(dirname(absolute), typescript.sys.fileExists);

  if (configPath) {
    const key = `${configPath}:${projectRoot ?? ''}`;
    const cached = compilerProjects.get(key);
    if (cached) return cached;

    const read = typescript.readConfigFile(configPath, typescript.sys.readFile);
    if (read.error) throw new Error(typescript.flattenDiagnosticMessageText(read.error.messageText, '\n'));
    const parsed = typescript.parseJsonConfigFileContent(read.config, typescript.sys, dirname(configPath));
    const configured = {
      key,
      // Compiler options belong to the project; its entire include glob does not belong
      // to this scan. Each declaration inspected below becomes a root and TypeScript
      // follows its imports. Seeding the monorepo here made a one-file scan compile it all.
      roots: [],
      // Handlers may be authored or emitted as JavaScript. They still need to belong to
      // the checked program so constructor parsing does not fail on the first cold scan.
      options: { ...parsed.options, allowJs: true, noEmit: true },
    };
    compilerProjects.set(key, configured);

    return configured;
  }

  const key = projectRoot ?? dirname(absolute);
  const cached = compilerProjects.get(key);
  if (cached) return cached;
  const configured = {
    key,
    roots: [],
    options: {
      target: typescript.ScriptTarget.ES2022,
      module: typescript.ModuleKind.Node16,
      moduleResolution: typescript.ModuleResolutionKind.Node16,
      strict: true,
      skipLibCheck: true,
      allowJs: true,
      noEmit: true,
    },
  };
  compilerProjects.set(key, configured);

  return configured;
}

/** Declare every file a run will read, so one program covers it. */
export async function seedTypeProgram(filePaths: readonly string[], projectRoot?: string): Promise<void> {
  const typescript = await loadTS();
  const grouped = new Map<string, { options: ts.CompilerOptions; paths: string[] }>();

  for (const filePath of filePaths) {
    const absolute = resolvePath(filePath);
    const typescript = getTS();
  const configured = compilerProjectOf(absolute, projectRoot);
    const group = grouped.get(configured.key) ?? { options: configured.options, paths: [] };
    group.paths.push(absolute);
    grouped.set(configured.key, group);
  }

  for (const [key, { options, paths }] of grouped) {
    const roots = new Set(typeProjects.get(key)?.roots ?? []);
    for (const path of paths) roots.add(path);
    typeProjects.set(key, { roots, options, program: builtProgram(key, [...roots], options) });
  }
}

/** The program a file belongs to, built once and widened as more files are asked for. */
export function projectOf(filePath: string, projectRoot?: string): { program: ts.Program; absolute: string } {
  const absolute = resolvePath(filePath);
  const configured = compilerProjectOf(absolute, projectRoot);
  let project = typeProjects.get(configured.key);

  if (!project) {
    // `path.resolve` is variadic, so handing it directly to `map` also passed the
    // index and the whole roots array as path segments. A fixture without a warm scan
    // cache exposed that first-run-only failure.
    const roots = new Set(configured.roots.map((root) => resolvePath(root)));
    roots.add(absolute);
    const program = builtProgram(configured.key, [...roots], configured.options);
    project = { roots, options: configured.options, program };
    typeProjects.set(configured.key, project);
  } else if (!project.roots.has(absolute)) {
    project.roots.add(absolute);
    project.program = builtProgram(configured.key, [...project.roots], project.options);
  }

  return { program: project.program, absolute };
}

export function checkedSourceOf(filePath: string, projectRoot?: string): { source: ts.SourceFile; checker: ts.TypeChecker } {
  const { program, absolute } = projectOf(filePath, projectRoot);
  const source = program.getSourceFile(absolute);
  if (!source) throw new Error(`TypeScript did not include '${absolute}' in its program.`);

  return { source, checker: program.getTypeChecker() };
}

/** A file, opened. Five places read and parsed one, each spelling the same two calls. */
export function sourceOf(filePath: string): ts.SourceFile {
  const ts = getTS();

  return ts.createSourceFile(filePath, readFileSync(filePath, 'utf-8'), ts.ScriptTarget.Latest, true);
}

// ── Class finding ────────────────────────────

/** Find the default exported class in a source file. */
export function findDefaultClass(source: ts.SourceFile): ts.ClassDeclaration | undefined {
  const ts = getTS();
  for (const stmt of source.statements) {
    // export default class Foo { ... }
    if (ts.isClassDeclaration(stmt) && stmt.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    ) && stmt.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
    )) {
      return stmt;
    }
  }

  // export default Foo (separate statement) — find the class it points to
  for (const stmt of source.statements) {
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals && ts.isIdentifier(stmt.expression)) {
      const name = stmt.expression.text;
      for (const s of source.statements) {
        if (ts.isClassDeclaration(s) && s.name?.text === name) return s;
      }
    }
  }

  return undefined;
}
