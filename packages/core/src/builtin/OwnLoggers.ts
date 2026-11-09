import type { Container } from '@fougere/container';
import type { Logger } from './Logger.js';

/** A class's deps, its `Logger` replaced by one named after it. */
export type OwnLogger = (className: string, deps: readonly string[]) => string[];

/**
 * Gives a class asking for `Logger` one named after it.
 * Ex: `app:blog:PricingService`.
 */
export function ownLoggers(scope: Container, replaced: boolean): OwnLogger {
  const given = new Set<string>();

  return (className, deps) => {
    if (replaced || !deps.includes('Logger')) return [...deps];

    const key = `Logger:${className}`;
    if (!given.has(key)) scope.registerValue(key, scope.resolve<Logger>('Logger').child(className));
    given.add(key);

    return deps.map((dep) => (dep === 'Logger' ? key : dep));
  };
}
