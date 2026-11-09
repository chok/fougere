import { addressOf, opsOf, getPresenterFields, builtOn, outputOf, seated, seatsOf, targetOf, type CollectorEntry, type EntityEntry, type HandlerEntry, type PresenterEntry, type ProviderEntry, type SeedEntry, viewsOf, isExtension, type ExtensionEntry } from '@fougere/core/descriptor';
import type { ErrorCode } from '@fougere/core';
import { basename } from 'node:path';
import { ANONYMOUS_SCHEMA_NAME, type SchemaView } from '@fougere/schema';
import { lowerFirst } from '@fougere/schema';
import { loadModule, loadOnce, record } from './run.js';
import { loadClass, loadDefault, seatOf, isEntityClass } from './project.js';
import { depsOf } from './deps.js';
import { inferOperations } from './contract.js';
import { parseRefusals, parsePresenterMethods, parseDeclaredAnswers } from './handler-parser.js';
import { parseAbstract } from './Abstract.js';
import { parseExtendedPort, parseImplements } from './Implemented.js';

export async function toProvider(filePath: string): Promise<ProviderEntry> {
  const ctor = await loadClass(filePath);
  const name = ctor.name;
  const deps = await depsOf(filePath);

  const stated = await parseImplements(filePath);
  const extended = await parseExtendedPort(filePath);
  const ports = [...stated.filter((one) => one.isClass), ...(extended?.isClass ? [extended] : [])];

  for (const { name: port, partial } of stated.filter((one) => one.isClass && !deps.includes(one.name))) {
    record({
      severity: 'warning',
      code: 'port-implemented-not-extended',
      filePath,
      subject: name,
      message: partial
        ? `${name} implements Partial<${port}> but takes no ${port}, so it stands in front of nothing. `
          + `To wrap it, take it: constructor(private inner: ${port}).`
        : `${name} implements ${port}, so it is not used for ${port}. Write \`class ${name} extends ${port}\`, `
          + `or take it — constructor(private inner: ${port}) — to stand in front of it.`,
    });
  }
  const links = ports.filter((one) => deps.includes(one.name)).map((one) => one.name);
  const answers = links.some((link) => link.includes('<')) ? Object.fromEntries(await parseDeclaredAnswers(filePath)) : {};
  const refusing = links.some((link) => link.startsWith('Collect<')) ? await collectorRefusals(filePath, name) : {};

  const seat = await seatOf(filePath);
  if (seat.length > 0) deps.push(...seatsOf(seat));

  return {
    name,
    ctor: seat.length > 0 ? seated(ctor, seat) : ctor,
    deps,
    filePath,
    ...(await parseAbstract(filePath) ? { abstract: true as const } : {}),
    ...(links.length > 0 ? { implements: links } : {}),
    ...(Object.keys(answers).length > 0 ? { answers } : {}),
    ...refusing,
  };
}

/** An extension file: a module stating `up`, `down` or `state`. */
export async function toExtensionEntry(filePath: string): Promise<ExtensionEntry | null> {
  const exported = await loadDefault(filePath);
  if (typeof exported !== 'object' || exported === null) return null;

  if (!isExtension(exported)) return null;

  return {
    name: typeof exported.name === 'string' ? exported.name : basename(filePath).replace(/\.[^.]+$/, ''),
    extension: exported,
    filePath,
  };
}

export async function toEntityEntry(filePath: string): Promise<EntityEntry | null> {
  const exported = (await loadOnce(filePath)).default;
  if (!isEntityClass(exported)) return null;
  const runtimeName = (exported as { name?: string }).name;
  const declaredName = runtimeName && runtimeName !== ANONYMOUS_SCHEMA_NAME
    ? runtimeName
    : basename(filePath).replace(/\.[^.]+$/, '');
  const name = lowerFirst(declaredName);

  return { name, entityClass: exported, filePath };
}

export async function toHandlerEntry(
  filePath: string,
  entityByClassName: Map<string, SchemaView>,
  collectorTypeNames: Set<string>,
  explicitInputs: ReadonlySet<string>,
  projectRoot?: string,
  surface?: string,
): Promise<HandlerEntry> {
  const mod = await loadModule(filePath);
  const written = mod.default;
  if (typeof written !== 'function' || !written.prototype)
    throw new Error(`${filePath}: default export is not a class`);
  const seat = await seatOf(filePath, projectRoot);
  const ctor = seat.length > 0 ? seated(written as ProviderEntry['ctor'], seat) : written;

  const augmented: Record<string, unknown> = { ...mod };
  for (const [className, entityClass] of entityByClassName) {
    if (!(className in augmented)) augmented[className] = entityClass;
  }

  const address = addressOf(ctor.name);
  const operations = await inferOperations(
    filePath,
    ctor.name,
    augmented,
    collectorTypeNames,
    explicitInputs,
    opsOf(ctor),
    projectRoot,
  );
  const deps = [...await depsOf(filePath), ...seatsOf(seat)];

  const subject = targetOf(ctor);
  const declared = outputOf(ctor);
  const outputOverride = declared && subject && declared !== subject
    ? (declared as unknown as SchemaView)
    : undefined;

  return {
    name: lowerFirst(ctor.name),
    address,
    ctor: ctor as ProviderEntry['ctor'],
    operations,
    deps,
    filePath,
    outputOverride,
    surface,
  };
}

function toSeedEntityName(fileName: string): string {
  const base = fileName.replace(/\.seed\.(ts|js)$/, '').replace(/\.(ts|js)$/, '');

  return lowerFirst(base);
}

export async function toSeedEntry(filePath: string): Promise<SeedEntry | null> {
  const data = await loadDefault(filePath);
  if (Array.isArray(data) || typeof data === 'function') {
    const fileName = filePath.split('/').pop()!;

    return { entityName: toSeedEntityName(fileName), data: data as SeedEntry['data'], filePath };
  }

  return null;
}

export async function toPresenterEntry(filePath: string): Promise<PresenterEntry | null> {
  const written = await loadClass(filePath);
  const [presented] = await seatOf(filePath, undefined, 'Present');
  const ctor = presented ? builtOn(written, presented) : written;
  const target = targetOf(ctor);
  if (!target) return null;
  const entityName = lowerFirst((target as { name: string }).name);
  const fields = getPresenterFields(ctor);
  const deps = await depsOf(filePath);

  let fieldMeta: PresenterEntry['fieldMeta'] = [];
  try {
    const parsed = await parsePresenterMethods(filePath);
    fieldMeta = parsed.map((m) => ({
      name: m.name,
      returnType: m.returnType?.name,
      list: (m.returnType?.arrayDepth ?? 0) > 1,
      nullable: m.returnType?.nullable,
      params: m.params.slice(1),
    }));

    for (const method of parsed) {
      const rows = method.params[0];
      if (rows && rows.type.array === true) continue;
      record({
        severity: 'blocking',
        code: 'presenter-field-not-page',
        filePath,
        subject: `${(ctor as { name?: string }).name ?? 'Presenter'}.${method.name}`,
        message: `${method.name}(${rows ? `${rows.name}: ${rows.type.raw}` : ''}) is a computed `
          + `field: it receives all the rows of a page and returns one value per row. Declare `
          + `${method.name}(${rows?.name ?? 'rows'}: ${(target as { name?: string }).name ?? 'Entity'}[]) `
          + `and return an array of the same length.`,
      });
    }
  } catch { /* parse failure — fall back to untyped */ }

  return { entityName, ctor, fields, fieldMeta, views: viewsOf(ctor), deps, filePath };
}

export async function toCollectorEntry(filePath: string): Promise<CollectorEntry | null> {
  const written = await loadClass(filePath);
  const [collected] = await seatOf(filePath, undefined, 'Collect');
  const ctor = collected ? builtOn(written, collected) : written;
  const target = targetOf(ctor);
  if (!target) return null;
  const typeName = lowerFirst((target as { name: string }).name);
  const deps = await depsOf(filePath);

  return { typeName, ctor, deps, filePath, ...await collectorRefusals(filePath, (ctor as { name: string }).name) };
}

async function collectorRefusals(filePath: string, className: string): Promise<Pick<CollectorEntry, 'refuses' | 'collecting'>> {
  const missing = `${className}.missing`;
  const collect = `${className}.collect`;
  const walked = await parseRefusals(filePath, (name) => name === missing || name === collect).catch(() => new Map<string, ErrorCode[]>());
  const refuses = walked.get(missing);
  const collecting = walked.get(collect);

  return { ...(refuses?.length ? { refuses } : {}), ...(collecting?.length ? { collecting } : {}) };
}
