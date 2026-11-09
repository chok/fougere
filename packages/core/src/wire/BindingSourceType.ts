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

/** One way a parameter gets its value besides the request: it binds, resolves, and judges a value code wrote. */
export interface BindingSourceType<K extends BindingSource['kind'] = BindingSource['kind']> {
  bind(param: Param, collectorTypeNames: ReadonlySet<string>): BindingSourceOf<K> | undefined;
  resolve(source: BindingSourceOf<K>, call: BindingCall): unknown;
  /** Refuses a required parameter this source resolved nothing for; returning lets core refuse with `Required`. */
  missing?(source: BindingSourceOf<K>, call: BindingCall): void;
  given(source: BindingSourceOf<K>, value: unknown, call: BindingCall): unknown;
}
