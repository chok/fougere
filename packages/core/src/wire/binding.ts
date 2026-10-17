/**
 * Where each parameter of an operation gets its value — decided once at boot from the parsed
 * signature (`computeBindingPlan`), replayed per call by `ArgumentResolver`. What travels and what
 * a `frond.config.ts` may state: the request's own parts are the kernel's, every other kind is
 * answered by the module that owns it (`BindingSources`).
 */

export type BindingSource =
  | { kind: 'collector'; typeName: string }
  /** `Fact<PostPublished>` — something that happened, not something a caller typed. */
  | { kind: 'fact'; factName: string }
  /**
   * `Pipe<PostPublished>` — the same thing, BEFORE it is final: what this op answers is
   * the fact every subscriber then receives. The core has one such link already
   * (`Emissions.stamped`, which realizes `created()`); this is the declared form of it.
   */
  | { kind: 'pipe'; factName: string }
  /**
   * `field` is where the value's rules are declared — `title: Post['title']`. `identifies` names
   * the entity whose row the value designates, when that field is its primary.
   */
  | { kind: 'param'; name: string; coerce?: 'number' | 'boolean'; field?: { entity: string; name: string }; identifies?: string }
  | { kind: 'input' }
  | { kind: 'context' }
  /** The whole query bag, for an op whose argument IS the options (list). */
  | { kind: 'query' };

interface ParamBinding {
  name: string;
  source: BindingSource;
  optional: boolean;
}

export type BindingPlan = ParamBinding[];
