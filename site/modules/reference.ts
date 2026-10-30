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
  const files = await globby(['packages/*/src/**/*.ts', 'packages/*/*/src/**/*.ts', 'packages/cli/fronds/**/*.ts'], { cwd: repository, ignore: ['**/*.d.ts', '**/dist/**'] });
  const interfaces = new Map<string, { file: string; members: Member[]; doc: string }>();
  const augmented = new Map<string, { file: string; members: Member[] }[]>();
  const exported = new Map<string, { file: string; doc: string; kind: string }>();
  const sources = new Map<string, import('@typescript/typescript6').default.SourceFile>();
  const diagnostics: { code: string; severity: string; message: string; file: string }[] = [];

  const membersOf = (node: import('@typescript/typescript6').default.InterfaceDeclaration, source: import('@typescript/typescript6').default.SourceFile) =>
    node.members.filter(ts.isPropertySignature).map((member) => ({
      name: member.name.getText(source),
      type: oneLine(member.type?.getText(source) ?? 'unknown'),
      optional: member.questionToken !== undefined,
      doc: docOf(ts, member),
    }));

  const textOf = (node: import('@typescript/typescript6').default.Expression, source: import('@typescript/typescript6').default.SourceFile): string => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => '…' + span.literal.text).join('');
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return textOf(node.left, source) + textOf(node.right, source);
    if (ts.isParenthesizedExpression(node)) return textOf(node.expression, source);
    return '…';
  };
  const findDiagnostics = (node: import('@typescript/typescript6').default.Node, source: import('@typescript/typescript6').default.SourceFile, file: string) => {
    if (ts.isObjectLiteralExpression(node)) {
      const property = (name: string) => node.properties.find((one) => ts.isPropertyAssignment(one) && one.name.getText(source) === name) as import('@typescript/typescript6').default.PropertyAssignment | undefined;
      const code = property('code');
      const severity = property('severity');
      if (code && severity && ts.isStringLiteral(code.initializer) && /^[a-z]+(-[a-z]+)+$/.test(code.initializer.text)) {
        const message = property('message');
        diagnostics.push({
          code: code.initializer.text,
          severity: ts.isStringLiteral(severity.initializer) ? severity.initializer.text : 'blocking',
          message: message ? oneLine(textOf(message.initializer, source)) : '',
          file,
        });
      }
    }
    ts.forEachChild(node, (child) => findDiagnostics(child, source, file));
  };

  for (const file of files) {
    const text = await readFile(join(repository, file), 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    sources.set(file, source);
    findDiagnostics(source, source, file);
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

  return { interfaces, augmented, exported, sources, diagnostics };
}

/** A file's package, by the nearest manifest above it — filled once per projection. */
const packageRoots = new Map<string, string>();
const packageOf = (file: string) => {
  const root = [...packageRoots.keys()].filter((one) => file.startsWith(`${one}/`)).sort((a, b) => b.length - a.length)[0];

  return root ? packageRoots.get(root)! : file;
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
  for (const manifest of await globby(['packages/*/package.json', 'packages/*/*/package.json'], { cwd: repository })) {
    packageRoots.set(manifest.replace(/\/package\.json$/, ''), JSON.parse(await readFile(join(repository, manifest), 'utf8')).name);
  }
  const { interfaces, augmented, exported, sources, diagnostics } = await read(repository, ts);
  const pages: [string, string][] = [];

  const interfacePage = (name: string, title: string, description: string, intro: string) => {
    const declared = interfaces.get(name);
    const body = (declared?.members ?? []).map(memberBlock).join('\n');

    return head(title, description) + intro + '\n\n' + body;
  };

  // A key open to packages lists who answers it, each linked to its page — read off the augmentations.
  const pageOf = (name: string) => `/reference/packages/${name.replace('@fougere/', '')}`;
  const answeredBy = (iface: string) => (augmented.get(iface) ?? []).flatMap(({ file, members }) =>
    members.map((member) => `\`${member.name}\` ([${packageOf(file)}](${pageOf(packageOf(file))}))`));
  const moduleKeys = (await globby(['packages/*/src/index.ts', 'packages/*/*/src/index.ts'], { cwd: repository }))
    .map((file) => ({ file, name: packageRoots.get(file.replace(/\/src\/index\.ts$/, '')) ?? '' }))
    .filter(({ file, name }) => {
      const last = name.split('/').pop() ?? '';
      return /^@fougere\//.test(name)
        && new RegExp(`export (async )?function ${last}\\(|export const ${last}\\b|export \\{[^}]*\\b${last}\\b[^}]*\\}`).test(sources.get(file)?.getFullText() ?? '');
    })
    .map(({ name }) => `[\`'${name}'\`](${pageOf(name)})`);
  const answers: Record<string, string> = {
    sources: `**\`type\` is one of:** ${answeredBy('FougereSources').join(' · ')}. Every key each one admits: [Source types](/reference/sources).`,
    protocols: `**Serves:** ${answeredBy('FougereProtocols').join(' · ')}. See [Protocols](/reference/protocols).`,
    state: `**Kept by:** ${answeredBy('FougereStates').join(' · ')}. See [State keepers](/reference/states).`,
    fronds: `**A package key:** ${moduleKeys.join(' · ')} — or a frond name, \`{ remote: '…' }\` to place it elsewhere.`,
    ports: `**Fougere's own ports:** see [Ports Fougere opens](/reference/ports).`,
  };
  const configPage = interfacePage('FougereConfig', 'fougere.config.ts', 'Every key the app config admits, and which package answers each one.',
    'What the app decides: where each frond runs, what answers each port, where rows live, what is served. A key open to packages lists who answers it — import the package, and its word exists. See [Configuration](/docs/concepts/configuration).')
    .replace(/### `(\w+)`\n\n([^\n]+)\n\n([\s\S]*?)(?=\n### |$)/g, (whole, key: string, type: string, body: string) =>
      answers[key] ? `### \`${key}\`\n\n${type}\n\n${body.trimEnd()}\n\n${answers[key]}\n` : whole);
  pages.push(['03.config.md', configPage]);
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

  const seen = new Map<string, typeof diagnostics[number]>();
  for (const one of diagnostics) if (!seen.has(one.code)) seen.set(one.code, one);
  const refusals = [...seen.values()].sort((one, other) => one.code.localeCompare(other.code));
  pages.push(['11.diagnostics.md', [head('Boot and check diagnostics', 'Every code a boot, the scan or fougere check can raise, and what it says.'),
    `What does not hold is named, with a code, the file to look at, and one sentence. A **blocking** one stops the boot; a **warning** is printed and the app starts. ${refusals.length} codes, read off the code that raises them.`, '',
    '| code | | what it says | raised by |', '|---|---|---|---|',
    ...refusals.map((one) => `| \`${one.code}\` | ${one.severity} | ${one.message.replace(/\|/g, '\\|').slice(0, 220) || '—'} | \`${packageOf(one.file)}\` |`), ''].join('\n')]);

  // One page per package: what it is, its entries, and what each exported name says of itself.
  const manifests = await globby(['packages/*/package.json', 'packages/*/*/package.json'], { cwd: repository });
  const packagePages: [string, string][] = [];
  for (const manifest of manifests.sort()) {
    const json = JSON.parse(await readFile(join(repository, manifest), 'utf8')) as {
      name: string; description?: string; private?: boolean; exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    if (json.private || !json.name.startsWith('@fougere/')) continue;
    const root = manifest.replace(/\/package\.json$/, '');
    const index = sources.get(`${root}/src/index.ts`);
    const names: { name: string; type: boolean }[] = [];
    const exportedHere = (node: { modifiers?: import('@typescript/typescript6').default.NodeArray<import('@typescript/typescript6').default.ModifierLike> }) =>
      node.modifiers?.some((one) => one.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    for (const statement of index?.statements ?? []) {
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name && exportedHere(statement)) {
        names.push({ name: statement.name.text, type: false });
      }
      if ((ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && exportedHere(statement)) {
        names.push({ name: statement.name.text, type: true });
      }
      if (ts.isVariableStatement(statement) && exportedHere(statement)) {
        for (const one of statement.declarationList.declarations) if (ts.isIdentifier(one.name)) names.push({ name: one.name.text, type: false });
      }
      if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
      for (const element of statement.exportClause.elements) {
        names.push({ name: element.name.text, type: statement.isTypeOnly || element.isTypeOnly });
      }
    }
    const docOfName = (name: string) => {
      const found = exported.get(name) ?? (interfaces.has(name) ? interfaces.get(name)! : undefined);
      return found && found.file.startsWith(root) ? found.doc : '';
    };
    const entries = Object.keys(json.exports ?? { '.': true }).filter((one) => !one.endsWith('.json'));
    const slug = json.name.replace('@fougere/', '');
    const lines = [head(json.name, json.description ?? `What ${json.name} exports.`), json.description ?? '', ''];

    // How it is used: the import, and the line of config, read off what the package augments.
    const extended = [...augmented.entries()].flatMap(([iface, list]) =>
      list.filter((one) => packageOf(one.file) === json.name).map((one) => ({ iface, file: one.file, keys: one.members })));
    const config: string[] = [];
    const frondConfig: string[] = [];
    const entityConfig: string[] = [];
    const sourceEntries: string[] = [];
    const protocolNames: string[] = [];
    const stateNames: string[] = [];
    for (const { iface, file, keys } of extended) {
      for (const key of keys) {
        if (iface === 'FougereSources') {
          const format = formatKeys(sources.get(file)!, key.type);
          const said = (format?.needs ?? []).filter((one) => one !== 'type').map((one) => `${one}: '…'`).join(', ');
          sourceEntries.push(`{ type: '${key.name}'${said ? `, ${said}` : ''} }`);
        }
        if (iface === 'FougereProtocols') protocolNames.push(key.name);
        if (iface === 'FougereStates') stateNames.push(key.name);
        if (iface === 'FougereFrondProtocols') frondConfig.push(`  protocols: { ${key.name}: { … } },`);
        if (iface === 'FougereOperationProtocols') frondConfig.push(`  operations: { 'post.list': { ${key.name}: { … } } },`);
        if (iface === 'FougereEntityAdapters') entityConfig.push(`export default class Post extends entity({ … }, { adapters: { ${key.name}: { … } } }) {}`);
      }
    }
    if (sourceEntries.length) {
      config.push(`  sources: { main: ${sourceEntries[0]} },`, ...sourceEntries.slice(1).map((one) => `  //   or main: ${one}`));
    }
    if (protocolNames.length) config.push(`  protocols: { ${protocolNames.map((one) => `${one}: {}`).join(', ')} },`);
    for (const name of stateNames) config.push(`  state: { cart: { ${name}: {} } },`);
    const moduleExport = slug.split('/').pop()!.replace(/^(adapter|state|transport|auth)-/, '');
    // A package branched by its key exports a function of its last name — the rule ConfigModules reads.
    const isModule = !extended.length && names.some((one) => !one.type && one.name === moduleExport) && !/^(core|schema|app|cli|compiler|testing|defaults|container|registry|graph|http|decorators)$/.test(slug);
    if (isModule) config.push(`  fronds: { '${json.name}': {} },`);

    if (config.length || frondConfig.length || entityConfig.length) {
      lines.push('## Use it', '');
      const peers = Object.keys(json.peerDependencies ?? {})
        .filter((peer) => !peer.startsWith('@fougere/') && !json.peerDependenciesMeta?.[peer]?.optional);
      lines.push('```bash pm', `npm install ${[json.name, ...peers].join(' ')}`, '```', '');
      if (config.length) {
        lines.push('```ts', '// fougere.config.ts', ...(extended.length ? [`import '${json.name}';`, ''] : []), 'export default defineFougere({', ...[...new Set(config)], '});', '```', '');
        if (isModule) lines.push(`The key names the package, and every process that reads the config calls its \`${moduleExport}()\` export and rises with it. Options that are more than a word go where the extension is built — in a frond's \`extensions/\`, or in \`createApp({ extensions })\`.`, '');
        if (extended.length) lines.push('The import is what makes the word exist: without it, the editor and the boot both refuse it.', '');
      }
      if (frondConfig.length) lines.push('```ts', '// fronds/blog/frond.config.ts', 'export default defineFrond({', ...[...new Set(frondConfig)], '});', '```', '');
      if (entityConfig.length) lines.push('```ts', ...new Set(entityConfig), '```', '');
      const linkFor: Record<string, string> = { FougereSources: '/reference/sources', FougereProtocols: '/reference/protocols', FougereStates: '/reference/states' };
      const each = extended.filter((one) => linkFor[one.iface]);
      if (each.length) lines.push(`Every key each one admits: ${[...new Set(each.map((one) => `[${one.iface.replace('Fougere', '').toLowerCase()}](${linkFor[one.iface]})`))].join(', ')}.`, '');
    }
    if (extended.length) {
      lines.push('## What it extends', '', 'The interfaces of Fougere this package adds its words to, with `declare module` — see [Interfaces to extend](/reference/interfaces).', '',
        '| interface | adds |', '|---|---|', ...extended.map(({ iface, keys }) => `| \`${iface}\` | ${keys.map((one) => `\`${one.name}\``).join(', ')} |`), '');
    }

    lines.push(`Entries: ${entries.map((one) => `\`${one === '.' ? json.name : `${json.name}/${one.replace('./', '')}`}\``).join(' · ')}`, '');
    const values = names.filter((one) => !one.type);
    const types = names.filter((one) => one.type);
    if (values.length) {
      lines.push('## What you import', '', '| name | |', '|---|---|',
        ...values.map(({ name }) => `| \`${name}\` | ${oneLine(docOfName(name).split('\n\n')[0] ?? '').replace(/\|/g, '\\|').slice(0, 240)} |`), '');
    }
    if (types.length) {
      lines.push('## Types', '', 'TypeScript types only — they do not run. Import them with `import type` to type your own code: a variable, a parameter, an option object.', '',
        '| name | |', '|---|---|',
        ...types.map(({ name }) => `| \`${name}\` | ${oneLine(docOfName(name).split('\n\n')[0] ?? '').replace(/\|/g, '\\|').slice(0, 240)} |`), '');
    }
    packagePages.push([join('packages', `${slug}.md`), lines.join('\n')]);
  }

  await rm(join(out, 'packages'), { recursive: true, force: true });
  await mkdir(join(out, 'packages'), { recursive: true });
  for (const [name, text] of packagePages) await writeFile(join(out, name), text.replace(/\n{3,}/g, '\n\n'));

  for (const [name] of pages) await rm(join(out, name), { force: true });
  await mkdir(out, { recursive: true });
  for (const [name, text] of pages) await writeFile(join(out, name), text.replace(/\n{3,}/g, '\n\n'));

  return pages.length + packagePages.length;
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
