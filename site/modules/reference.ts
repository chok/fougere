import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { globby } from 'globby';
import { defineNuxtModule } from 'nuxt/kit';

/**
 * `packages/**​/src` → `content/reference/<nn>.<page>.md`, at build — what a config admits, what a
 * package opens to be extended, and the types a frond is written with, read off the code itself.
 *
 * Nothing is booted and nothing is type-checked: the sources are parsed, and what a page says of
 * an entry is its JSDoc. A key with no sentence says so on the page, which is where it shows.
 */

type TS = typeof import('@typescript/typescript6').default;

interface Member { name: string; type: string; optional: boolean; doc: string }

/** The reading the scan already uses, from the package that depends on it. */
function typescript(repository: string): TS {
  return createRequire(join(repository, 'packages', 'compiler', 'package.json'))('@typescript/typescript6');
}

const docOf = (ts: TS, node: import('@typescript/typescript6').default.Node): string => {
  const docs = (node as { jsDoc?: { comment?: unknown }[] }).jsDoc ?? [];
  const text = docs.map((one) => (typeof one.comment === 'string' ? one.comment : ts.getTextOfJSDocComment(one.comment as never) ?? '')).join('\n');

  return text.replace(/\n?Documented: \[[^\n]*$/m, '').trim();
};

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/** What a package's sources declare, read once: interfaces, their augmentations, and every other export. */
async function read(repository: string, ts: TS) {
  const files = await globby(['packages/*/src/**/*.ts', 'packages/*/*/src/**/*.ts'], { cwd: repository, ignore: ['**/*.d.ts', '**/dist/**'] });
  const interfaces = new Map<string, { file: string; members: Member[]; doc: string }>();
  const augmented = new Map<string, { file: string; members: Member[] }[]>();
  const exported = new Map<string, { file: string; doc: string; kind: string }>();
  const sources = new Map<string, import('@typescript/typescript6').default.SourceFile>();

  const membersOf = (node: import('@typescript/typescript6').default.InterfaceDeclaration, source: import('@typescript/typescript6').default.SourceFile) =>
    node.members.filter(ts.isPropertySignature).map((member) => ({
      name: member.name.getText(source),
      type: oneLine(member.type?.getText(source) ?? 'unknown'),
      optional: member.questionToken !== undefined,
      doc: docOf(ts, member),
    }));

  for (const file of files) {
    const text = await readFile(join(repository, file), 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    sources.set(file, source);
    const exportedHere = (node: { modifiers?: import('@typescript/typescript6').default.NodeArray<import('@typescript/typescript6').default.ModifierLike> }) =>
      node.modifiers?.some((one) => one.kind === ts.SyntaxKind.ExportKeyword) ?? false;

    for (const statement of source.statements) {
      if (ts.isInterfaceDeclaration(statement) && exportedHere(statement)) {
        interfaces.set(statement.name.text, { file, members: membersOf(statement, source), doc: docOf(ts, statement) });
      }
      if ((ts.isClassDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isFunctionDeclaration(statement)) && statement.name && exportedHere(statement)) {
        const kind = ts.isClassDeclaration(statement) ? 'class' : ts.isFunctionDeclaration(statement) ? 'function' : 'type';
        if (!exported.has(statement.name.text)) exported.set(statement.name.text, { file, doc: docOf(ts, statement), kind });
      }
      if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name) && statement.body && ts.isModuleBlock(statement.body)) {
        for (const inner of statement.body.statements) {
          if (!ts.isInterfaceDeclaration(inner)) continue;
          const list = augmented.get(inner.name.text) ?? [];
          list.push({ file, members: membersOf(inner, source) });
          augmented.set(inner.name.text, list);
        }
      }
    }
  }

  return { interfaces, augmented, exported, sources };
}

const packageOf = (file: string) => {
  const [, first, second] = file.split('/');

  return second === 'src' ? `@fougere/${first}` : `@fougere/${first === 'adapter' || first === 'state' || first === 'transport' ? `${first}-${second}` : second}`;
};

/** The keys an entry of a registered type admits, read off the `Format` its augmentation names. */
function formatKeys(source: import('@typescript/typescript6').default.SourceFile, type: string): { keys: string[]; needs: string[] } | undefined {
  const name = /typeof (\w+)/.exec(type)?.[1];
  if (!name) return undefined;
  const text = source.getFullText();
  const declared = new RegExp(`const ${name} = ([\\s\\S]*?);\\n`).exec(text)?.[1];
  if (!declared) return undefined;
  const called = /^(\w+)\(/.exec(declared)?.[1];
  const body = called ? new RegExp(`const ${called} = [\\s\\S]*?;\\n`).exec(text)?.[0] ?? declared : declared;
  const keys = [...body.matchAll(/\.key\('(\w+)'/g)].map((m) => m[1]!);
  const needs = [...(/\.needs\(([^)]*)\)/.exec(body)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]!);

  return { keys, needs };
}

const head = (title: string, description: string) =>
  ['---', `title: ${JSON.stringify(title)}`, `description: ${JSON.stringify(description)}`, '---', '', `# ${title}`, ''].join('\n');

const memberBlock = (member: Member) =>
  [`### \`${member.name}\``, '', `\`${member.type}\`${member.optional ? ' · optional' : ' · required'}`, '',
    member.doc || '_No sentence yet in the code._', ''].join('\n');

/** Forms a frond is written with, and the ports Fougere opens — which names are which is a reading, not a fact of the code. */
const FORMS = ['Repository', 'Facade', 'Emit', 'Fact', 'Pipe', 'Collect', 'Present', 'Together', 'State', 'Mirror'];
const PORTS = ['Dispatcher', 'Storage', 'Logger', 'Rest', 'Journal'];
/** Written by the scan into `.fougere/`, never by hand. */
const SCANNED = new Set(['FougereHandlers', 'FougereOperations', 'FougereNames', 'FougerePorts']);

async function project(repository: string, out: string) {
  const ts = typescript(repository);
  const { interfaces, augmented, exported, sources } = await read(repository, ts);
  const pages: [string, string][] = [];

  const interfacePage = (name: string, title: string, description: string, intro: string) => {
    const declared = interfaces.get(name);
    const body = (declared?.members ?? []).map(memberBlock).join('\n');

    return head(title, description) + intro + '\n\n' + body;
  };

  pages.push(['03.config.md', interfacePage('FougereConfig', 'fougere.config.ts', 'Every key the app config admits, with what the code says of it.',
    'What the app decides: where each frond runs, what answers each port, where rows live, what is served. See [Configuration](/docs/concepts/configuration).')]);
  pages.push(['04.frond-config.md', interfacePage('FrondConfig', 'frond.config.ts', "Every key a frond's own config admits.",
    "What one frond decides for itself, and wins for its own scope.") + '\n## Per operation\n\n' + (interfaces.get('OperationOverride')?.members ?? []).map(memberBlock).join('\n')]);

  const registered = (name: string, title: string, description: string, key: string) => {
    const lines = [head(title, description), `Each type is a word an entry of \`${key}\` may name, answered by the package that augments \`${name}\` — import it and the word exists.`, ''];
    for (const { file, members } of augmented.get(name) ?? []) {
      for (const member of members) {
        const keys = formatKeys(sources.get(file)!, member.type);
        lines.push(`### \`${member.name}\``, '', `From \`${packageOf(file)}\`.`, '');
        if (keys) {
          lines.push('| key | |', '|---|---|', ...keys.keys.map((one) => `| \`${one}\` | ${keys.needs.includes(one) ? 'required' : 'optional'} |`), '');
        } else {
          lines.push(`\`${member.type}\``, '');
        }
      }
    }

    return lines.join('\n');
  };
  pages.push(['05.sources.md', registered('FougereSources', 'Source types', 'Every type an entry of sources: may name, and the keys it admits.', 'sources:')
    .replace('import it and the word exists.', 'import it and the word exists. Every entry also takes `rows:` — the entities it holds — and `values:` — the entities it holds as one value; the entry with no `rows:` holds the rest.')]);
  pages.push(['06.protocols.md', registered('FougereProtocols', 'Protocols', 'What protocols: may serve, and what each admits.', 'protocols:')]);
  pages.push(['07.states.md', registered('FougereStates', 'State keepers', "How state: may keep a caller's values.", 'state:')]);

  const typed = (names: string[], title: string, description: string, intro: string) => {
    const lines = [head(title, description), intro, ''];
    for (const name of names) {
      const found = exported.get(name) ?? (interfaces.has(name) ? { file: interfaces.get(name)!.file, doc: interfaces.get(name)!.doc, kind: 'interface' } : undefined);
      if (!found) continue;
      lines.push(`### \`${name}\``, '', `${found.kind} · \`${packageOf(found.file)}\``, '', found.doc || '_No sentence yet in the code._', '');
    }

    return lines.join('\n');
  };
  pages.push(['08.forms.md', typed(FORMS, 'Forms', 'The types a frond is written with — each one read by the scan.',
    'You write these in a signature or after `extends`; the scan reads them and wires what they say. See [What is Fougere](/docs).')]);
  pages.push(['09.ports.md', typed(PORTS, 'Ports Fougere opens', 'The classes you stand in front of, or extend, to change what the framework does.',
    'A class that implements one and asks for it stands in front of it; see [Port](/docs/concepts/port).')]);

  const extensible = [...interfaces.entries()].filter(([name, one]) => /^Fougere[A-Z]/.test(name) && one.members.length === 0);
  const lines = [head('Interfaces to extend', 'The empty interfaces a package augments with declare module, and who augments each.'),
    'Each one is empty in the package that declares it. A package adds its line with `declare module` — that is how an adapter makes a word exist for the editor.', ''];
  for (const [name, one] of extensible.sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### \`${name}\``, '', `Declared by \`${packageOf(one.file)}\`.${SCANNED.has(name) ? ' Written by the scan into `.fougere/`, never by hand.' : ''}`, '', one.doc || '', '');
    const by = augmented.get(name) ?? [];
    if (by.length && !SCANNED.has(name)) {
      const byPackage = new Map<string, string[]>();
      for (const { file, members } of by) byPackage.set(packageOf(file), [...(byPackage.get(packageOf(file)) ?? []), ...members.map((m) => m.name)]);
      lines.push('| augmented by | keys |', '|---|---|', ...[...byPackage].map(([pkg, keys]) => `| \`${pkg}\` | ${keys.map((key) => `\`${key}\``).join(', ')} |`), '');
    }
  }
  pages.push(['10.interfaces.md', lines.join('\n')]);

  for (const [name] of pages) await rm(join(out, name), { force: true });
  await mkdir(out, { recursive: true });
  for (const [name, text] of pages) await writeFile(join(out, name), text.replace(/\n{3,}/g, '\n\n'));

  return pages.length;
}

export default defineNuxtModule({
  meta: { name: 'reference' },
  async setup(_options, nuxt) {
    const repository = join(nuxt.options.rootDir, '..');
    const out = join(nuxt.options.rootDir, 'content', 'reference');
    console.info(`[reference] ${await project(repository, out)} pages read off packages/*/src`);
    nuxt.hook('builder:watch', async (_event, path) => {
      if (relative(repository, path).startsWith('packages/')) await project(repository, out);
    });
  },
});
