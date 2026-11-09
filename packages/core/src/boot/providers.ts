import type { Container } from '@fougere/container';
import { aroundCalls, DISPATCH } from './calls.js';
import { doorStepOf, standingAtDoors } from './doors.js';
import type { Plugged } from '../wire/Plugged.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import type { Logger } from '../builtin/Logger.js';
import { type OwnLogger } from '../builtin/OwnLoggers.js';
import { nameOf } from '../descriptor/FrondDescriptor.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import { lifetimeOf } from '../lifetime.js';
import type { Diagnostic } from '../diagnostic.js';
import type { DoorAround } from '../entry/door.js';
import { linkOf, ownKeyOf, portBindings, hostPortChains, HOST_PORTS } from './ports.js';
import type { Assembly } from './install.js';
import { registerRepositories } from './storages.js';

export function registerMiddlewares(
  frond: FrondDescriptor,
  scope: Container,
  assembly: Assembly,
): void {
  const { use, middlewaresOf, doorMiddlewaresOf, doorMiddlewaresAt } = assembly;
  const addresses = new Set(frond.handlers.map((h) => h.address));
  const inherited = frond.extends ? middlewaresOf.get(frond.extends) ?? [] : [];
  const mine: AppMiddleware[] = [];

  const inheritedAtDoors = frond.extends ? doorMiddlewaresOf.get(frond.extends) ?? [] : [];
  const mineAtDoors: (DoorAround & { at?: ReadonlySet<string> })[] = [];

  const calls = DISPATCH.standing(frond, assembly.plugged);
  mine.push(...calls.filter((one) => !one.at).map(({ key }) => aroundCalls(scope, key)));
  mineAtDoors.push(...standingAtDoors(frond, scope, assembly.plugged, assembly.refused));

  for (const around of [...inherited, ...mine]) {
    for (const address of addresses) use(around, address);
  }
  for (const { key, at } of calls) {
    if (!at) continue;
    const around = aroundCalls(scope, key);
    for (const address of at) use(around, address);
  }
  middlewaresOf.set(frond.name, [...inherited, ...mine]);
  doorMiddlewaresOf.set(frond.name, [...inheritedAtDoors, ...mineAtDoors.filter((one) => !one.at)]);
  for (const address of addresses) {
    doorMiddlewaresAt.set(address, [...inheritedAtDoors, ...mineAtDoors.filter((one) => !one.at || one.at.has(address))]);
  }
}

export function inheritedHostPorts(
  frond: FrondDescriptor,
  hostPortsOf: Map<string, Map<string, ProviderEntry[]>>,
  declared: Map<string, ProviderEntry[]>,
): Map<string, ProviderEntry[]> {
  const above = frond.extends ? hostPortsOf.get(frond.extends) : undefined;
  if (!above) return declared;

  const all = new Map(declared);
  for (const [seam, links] of above) all.set(seam, [...links, ...(declared.get(seam) ?? [])]);

  return all;
}

export function registerProviders(
  frond: FrondDescriptor,
  scope: Container,
  ports: CreateAppOptions['ports'],
  boundPorts: Set<string>,
  refused: Diagnostic[],
  ownLogger: OwnLogger,
  frondLog: Logger,
  plugged: Plugged[],
  realizations: readonly ProviderEntry[],
): Map<string, ProviderEntry[]> {
  const hostPorts = hostPortChains(frond.providers, ports, refused);
  const links = new Set([...hostPorts.values()].flat());
  const registered = new Set<string>();
  for (const provider of frond.providers) {
    if (links.has(provider) || registered.has(nameOf(provider))) continue;
    registered.add(nameOf(provider));
    scope.register(nameOf(provider), provider.ctor, { deps: ownLogger(nameOf(provider), provider.deps), ...lifetimeOf(provider.ctor) });
  }
  registerRepositories(frond, scope, refused, ownLogger, plugged);
  for (const [seam, links] of hostPorts) {
    boundPorts.add(seam);
    frondLog.debug(`seam ${seam} → ${links.map((one) => one.ctor.name).join(' → ')} → the realization`);
    plugged.push({ point: seam, by: 'type', frond: frond.name, answers: [...links.map(nameOf), 'the realization'] });
  }
  for (const [port, chain] of portBindings([...frond.providers, ...realizations], (n) => scope.has(n), ports, refused)) {
    if (chain.length === 0) continue;
    if (HOST_PORTS.has(port)) continue;
    const realization = chain.at(-1)!;
    const wraps = realization.deps.includes(port);
    const wrappers = wraps ? chain : chain.slice(0, -1);
    let inner = wraps ? ownKeyOf(port) : nameOf(realization);
    if (wraps) scope.registerValue(inner, scope.resolve(port));
    for (const wrapper of wrappers.slice(1).reverse()) {
      const deps = ownLogger(nameOf(wrapper), wrapper.deps).map((dep) => (dep === port ? inner : dep));
      inner = nameOf(wrapper);
      scope.replace(inner, linkOf(wrapper, port), { deps, ...lifetimeOf(wrapper.ctor) });
    }
    const outermost = chain[0]!;
    const outermostOptions = {
      deps: ownLogger(nameOf(outermost), outermost.deps).map((dep) => (dep === port ? inner : dep)),
      ...lifetimeOf(outermost.ctor),
    };
    const Outermost = linkOf(outermost, port);
    if (wrappers.length > 0) scope.replace(nameOf(outermost), Outermost, outermostOptions);
    if (scope.has(port)) scope.replace(port, Outermost, outermostOptions);
    else scope.register(port, Outermost, outermostOptions);
    boundPorts.add(port);
    frondLog.debug(`port ${port} → ${chain.map((one) => one.ctor.name).join(' → ')}`);
    plugged.push({ point: port, by: 'type', frond: frond.name, answers: [...chain.map(nameOf), ...(wraps ? [innermostOf(port)] : [])] });
  }
  if (frond.providers.length > 0) {
    frondLog.debug(`${frond.providers.length} provider(s): ${frond.providers.map(nameOf).join(', ')}`);
  }

  return hostPorts;
}

function innermostOf(port: string): string {
  const step = DISPATCH.covers(port) ? DISPATCH : doorStepOf(port);
  if (step) return step.innermost;
  if (port.startsWith('Env<')) return 'the source';

  return `the ${port} the frond had`;
}
