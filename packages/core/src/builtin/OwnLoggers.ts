import type { Container } from '@fougere/container';
import type { Logger } from './Logger.js';

/** A class's deps, its `Logger` replaced by one named after it. */
export type OwnLogger = (className: string, deps: readonly string[]) => string[];

/**
 * A class asking for `Logger` gets one named after it — `app:blog:PricingService` — under a key of
 * its own, so the container builds nothing new. A frond that `replaced` it with a class of its own
 * keeps that class whole: `child()` hands back a bare `Logger`.
 */
export function ownLoggers(scope: Container, replaced: boolean): OwnLogger {
  return (className, deps) => {
    if (replaced || !deps.includes('Logger')) return [...deps];

    const key = `Logger:${className}`;
    scope.registerValue(key, scope.resolve<Logger>('Logger').child(className));

    return deps.map((dep) => (dep === 'Logger' ? key : dep));
  };
}
