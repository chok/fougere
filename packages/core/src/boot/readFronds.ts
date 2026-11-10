import { resolveConventions } from '../config/Conventions.js';
import { servedProtocols } from './protocols.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import { hostedBy } from './hosted.js';
import { termRefusals } from './terms.js';
import { nestingOf, parentsFirst } from './nesting.js';
import type { Fronds } from '../descriptor/Fronds.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { refusalOf, type Diagnostic } from '../diagnostic.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import { Logger } from '../builtin/Logger.js';
import { resolveEffectiveOperations, type EffectiveOperationModel } from '../operation/EffectiveOperationModel.js';
import { facadeKeyOf } from '../wire/Facade.js';
import { presenterKeyOf } from '../prefab/presenter.js';

export function refuseDuplicateKeys(
  fronds: { name: string; handlers: HandlerEntry[]; presenters: PresenterEntry[] }[],
  remotes: Record<string, string> | undefined,
  refused: Diagnostic[],
): void {
  const owner = new Map<string, string>();
  const fileOf = new Map<string, string>();

  const register = (key: string, frond: string, what: string, filePath: string) => {
    const first = owner.get(key);
    if (first !== undefined && first !== frond) {
      refused.push({
        severity: 'blocking',
        code: 'frond-key-taken',
        filePath,
        frond,
        subject: key,
        message: `The fronds '${first}' and '${frond}' both have a ${what} answering ${key}, the other in ${fileOf.get(key)}. `
          + 'Rename one, or leave one frond out of this process (only:).',
      });

      return;
    }
    owner.set(key, frond);
    fileOf.set(key, filePath);
  };

  for (const frond of fronds) {
    if (remotes && frond.name in remotes) continue;
    for (const handler of frond.handlers) register(facadeKeyOf(handler.address, handler.surface), frond.name, 'handler', handler.filePath);
    for (const presenter of frond.presenters) register(presenterKeyOf(presenter.entityName), frond.name, 'presenter', presenter.filePath);
  }
}

export async function readFronds(
  options: CreateAppOptions,
  log: Logger,
  keeperFronds: readonly FrondDescriptor[],
): Promise<{ fronds: Fronds; operationModel: EffectiveOperationModel }> {
  const scanStart = performance.now();
  const fromExtensions = [...(options.extensions ?? []).flatMap((extension) => extension?.fronds ?? []), ...keeperFronds]
    .map((frond) => ({ ...frond, fromExtension: true as const }));
  const fronds = hostedBy([...(options.fronds ?? []), ...fromExtensions]);
  const diagnostics: Diagnostic[] = [];
  if (!options.fronds && fromExtensions.length === 0) {
    throw new Error(
      'createApp needs `fronds:`, the list of fronds this app runs. Pass one:\n'
      + '    createApp({ fronds: [blog] })\n'
      + '    createApp({ ...(await appOptionsOf(root)) })',
    );
  }

  const conventions = resolveConventions(options.conventions);
  const { under, refused } = nestingOf(options.under, fronds, options.remotes, options.narrowed, conventions, (name) => options.values?.sourceOf(name) !== undefined);
  const refusal = refusalOf(refused, 'thing(s) the frond tree does not allow');
  if (refusal) throw refusal;

  for (const frond of fronds) {
    const parent = under.get(frond.name);
    if (parent !== undefined) frond.extends = parent;
  }
  const ordered = parentsFirst(fronds, under);

  for (const term of options.vocabulary ?? []) term.register();
  const termRefusal = refusalOf(termRefusals(ordered, conventions), 'term(s) nothing in this process answers');
  if (termRefusal) throw termRefusal;

  const operationModel = resolveEffectiveOperations(ordered, {
    conventions,
    diagnostics,
    remotes: options.remotes,
    protocols: servedProtocols(options.protocols, ordered),
  });
  const scanMs = (performance.now() - scanStart).toFixed(0);
  log.info(`read ${ordered.length} frond(s) in ${scanMs}ms`
    + (diagnostics.length ? ` — ${diagnostics.length} thing(s) the scan could not do` : ''));

  /** Say what could not be read, at the one line everyone already watches. */
  for (const d of diagnostics.filter((one) => one.severity === 'blocking')) log.error(`[${d.code}] ${d.message}`, d.cause);
  for (const d of diagnostics) if (d.severity === 'warning') log.warn(`[${d.code}] ${d.message}`);

  const unresolved = refusalOf(operationModel.resolutionDiagnostics, 'unresolved operation contract(s)');
  if (unresolved) throw unresolved;

  return { fronds: ordered, operationModel };
}
