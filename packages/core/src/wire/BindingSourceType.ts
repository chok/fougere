import type { Container } from '@fougere/container';
import type { SchemaView } from '@fougere/schema';
import type { BindingSource } from './binding.js';
import type { InvocationContext } from './InvocationContext.js';
import type { Param } from './Param.js';

export type BindingSourceOf<K extends BindingSource['kind']> = Extract<BindingSource, { kind: K }>;

/** What a call hands the source that fills one parameter. */
export interface BindingCall {
  ctx: InvocationContext;
  /** The scope the handler resolves in — where a collector is found. */
  scope?: Container;
  /** The op's input contract, which a value code wrote is judged against. */
  input?: SchemaView;
}

/**
 * One way a parameter gets its value, beyond the request itself: it BINDS a parameter from its
 * signature, RESOLVES it from a call, and judges a value code wrote in its place (`given`).
 */
export interface BindingSourceType<K extends BindingSource['kind'] = BindingSource['kind']> {
  bind(param: Param, collectorTypeNames: ReadonlySet<string>): BindingSourceOf<K> | undefined;
  resolve(source: BindingSourceOf<K>, call: BindingCall): unknown;
  /**
   * A parameter with no `?` it resolved nothing for — refused here, in this source's own words
   * (`UNAUTHORIZED` for a user nobody signed in). Returning means it has none: core refuses with
   * `Required`. Never asked of an optional parameter, whose absence is a value.
   */
  missing?(source: BindingSourceOf<K>, call: BindingCall): void;
  given(source: BindingSourceOf<K>, value: unknown, call: BindingCall): unknown;
}
