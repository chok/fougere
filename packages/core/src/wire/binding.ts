/** Where each parameter of an operation gets its value, decided at boot and replayed per call. */

export type BindingSource =
  | { kind: 'collector'; typeName: string }
  /** `Fact<PostPublished>` — something that happened, not something a caller typed. */
  | { kind: 'fact'; factName: string }
  /** `Pipe<T>`: what this op answers is the fact every subscriber then receives. */
  | { kind: 'pipe'; factName: string }
  /** `field` is where the value's rules are declared; `identifies` names the entity whose row it designates. */
  | { kind: 'param'; name: string; coerce?: 'number' | 'boolean'; field?: { entity: string; name: string }; identifies?: string }
  | { kind: 'input' }
  | { kind: 'context' }
  /** The whole query bag, for an op whose argument IS the options (list). */
  | { kind: 'query' }
  /** `State` — the caller's kept state, read and written through the request. */
  | { kind: 'state' };

interface ParamBinding {
  name: string;
  source: BindingSource;
  optional: boolean;
}

export type BindingPlan = ParamBinding[];
