import type { Container } from '@fougere/container';
import { Graph } from '@fougere/graph';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';

/**
 * Classes that ask for each other — refused at boot rather than at the first call that builds one.
 * Read off what the container was HANDED, since a port's chain hands a wrapper the next link where
 * its constructor names the port, and per scope, since a dependency is resolved where it is held.
 */
export function dependencyCycles(container: Container, fronds: readonly FrondDescriptor[]): Diagnostic[] {
  const refused: Diagnostic[] = [];
  const scopes: [Container, FrondDescriptor | undefined][] = [
    [container, undefined],
    ...fronds
      .filter((frond) => container.has(`frond:${frond.name}`))
      .map((frond) => [container.resolve<Container>(`frond:${frond.name}`), frond] as [Container, FrondDescriptor]),
  ];

  for (const [scope, frond] of scopes) {
    const registered = scope.dependencies();
    const dependencies = new Graph();
    for (const name of registered.keys()) dependencies.add(name);
    for (const [name, asked] of registered) {
      for (const dependency of asked) {
        if (registered.has(dependency)) dependencies.connect(name, dependency, dependency);
      }
    }

    for (const path of dependencies.cycles()) refused.push(cycleRefused(path, frond));
  }

  return refused;
}

function cycleRefused(path: string[], frond: FrondDescriptor | undefined): Diagnostic {
  const [first, second] = path;
  const declared = frond && [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors, ...frond.middlewares]
    .find(({ ctor }) => ctor.name === first);

  return {
    severity: 'blocking',
    code: 'dependency-cycle',
    frond: frond?.name,
    subject: first,
    filePath: declared?.filePath ?? frond?.source.path ?? '',
    message: path.length === 2
      ? `${first} asks for itself in its constructor, so it can never be built. Remove that parameter.`
      : `${path.join(' → ')}: each asks for the next in its constructor, so none of them can be built first. `
        + `Remove ${second} from ${first}'s constructor, or one of the others.`,
  };
}
