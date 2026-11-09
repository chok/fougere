import { frondDirsOf, frondPackage, resolveConventions, type Conventions, type ConventionsInput, type ScanResult } from '@fougere/core';
import { Fronds, isCollect, isPresent, type FrondDescriptor, FrondConfigReading, Term } from '@fougere/core/descriptor';
import { frondNamesOf, loadFrondConfig } from '@fougere/core/node';
import { join } from 'node:path';
import { findings, loadModule, startRun, vocabulary } from './run.js';
import { dirs, files, loadClass, findWorkspaceRoot } from './project.js';
import { toProvider, toExtensionEntry, toEntityEntry, toHandlerEntry, toSeedEntry, toPresenterEntry, toCollectorEntry } from './entries.js';
import { resetTypePrograms, seedTypeProgram } from './TypeProgram.js';

async function scanFrond(frondPath: string, name: string, source: FrondDescriptor['source'], conventions: Conventions, projectRoot?: string): Promise<FrondDescriptor> {
  const {
    entities: entitiesDir, handlers: handlersDir, services: servicesDir, seeds: seedsDir,
  } = conventions.dirs;
  const collect = async <T extends object>(
    dir: string,
    read: (filePath: string) => Promise<T | null>,
  ): Promise<T[]> => {
    const entries: (T | null)[] = await Promise.all((await files(join(frondPath, dir))).map(read));

    return entries.filter((entry): entry is T => entry !== null);
  };

  for (const filePath of await files(join(frondPath, conventions.dirs.vocabulary))) {
    const exported = Object.entries(await loadModule(filePath)).filter(([, value]) => Term.is(value));
    vocabulary.push(...exported.map(([exportName, term]) => ({ term: term as Term<unknown>, name: exportName, filePath })));
  }

  const services = await collect(servicesDir, async (filePath) => ({ filePath, ctor: await loadClass(filePath) }));
  const extending = (base: (ctor: unknown) => boolean) => services.filter(({ ctor }) => base(ctor)).map(({ filePath }) => filePath);
  const plain = services.filter(({ ctor }) => !isCollect(ctor) && !isPresent(ctor)).map(({ filePath }) => filePath);
  const providers = await Promise.all(plain.map(toProvider));
  const entities = await collect(entitiesDir, toEntityEntry);
  const extensions = await collect(conventions.dirs.extensions, toExtensionEntry);
  const collectors = (await Promise.all(extending(isCollect).map(toCollectorEntry))).filter((entry) => entry !== null);
  const collectorTypeNames = new Set(collectors.map((collector) => collector.typeName));
  const frondConfig = await loadFrondConfig(frondPath);
  const explicitInputs = new Set(
    Object.entries(frondConfig?.operations ?? {})
      .filter(([, contract]) => contract.input !== undefined)
      .map(([operation]) => operation),
  );

  const entityByClassName = new Map(
    entities.map((e) => [(e.entityClass as { name: string }).name, e.entityClass]),
  );
  const handlers = await collect(handlersDir, (f) =>
    toHandlerEntry(f, entityByClassName, collectorTypeNames, explicitInputs, projectRoot));

  for (const surface of await dirs(join(frondPath, handlersDir))) {
    handlers.push(...await collect(join(handlersDir, surface), (f) =>
      toHandlerEntry(f, entityByClassName, collectorTypeNames, explicitInputs, projectRoot, surface)));
  }

  const presenters = (await Promise.all(extending(isPresent).map(toPresenterEntry))).filter((entry) => entry !== null);
  const seeds = await collect(seedsDir, toSeedEntry);
  const reading = new FrondConfigReading(frondConfig);
  reading.markExposed(entities, handlers);

  return {
    name,
    source,
    providers,
    entities,
    handlers,
    presenters,
    collectors,
    seeds,
    ...(extensions.length > 0 ? { extensions } : {}),
    ...reading.members(),
  };
}

export async function scanProject(
  root: string,
  filter?: string[],
  conventionsInput?: ConventionsInput,
): Promise<ScanResult> {
  const conventions = resolveConventions(conventionsInput);
  resetTypePrograms();
  startRun();

  const frondsDir = join(root, conventions.fronds);
  const dirNames = await dirs(frondsDir);
  const workspaceRoot = findWorkspaceRoot(root);

  const declarations = (await Promise.all(
    dirNames.map((dir) => join(frondsDir, dir)).flatMap((frondPath) =>
      frondDirsOf(conventions).map((dir) => files(join(frondPath, dir)))),
  )).flat();
  await seedTypeProgram(declarations, workspaceRoot);
  await seedTypeProgram(declarations);

  const names = frondNamesOf(root, conventions);
  const all = await Promise.all(
    dirNames.map(async (dir) => {
      const name = names.get(dir) ?? dir;

      return scanFrond(
        join(frondsDir, dir), name,
        { path: join(frondsDir, dir), package: frondPackage(name, conventions) },
        conventions,
        workspaceRoot,
      );
    }),
  );
  const fronds = Fronds.list(filter ? all.filter((f) => filter.includes(f.name)) : all);

  const { diagnostics, vocabulary } = findings();

  return { root, fronds, diagnostics, ...(vocabulary.length > 0 ? { vocabulary } : {}) };
}
