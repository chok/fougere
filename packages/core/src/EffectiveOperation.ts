import { EFFECTIVE_OPERATION_SEMANTICS } from './EffectiveOperationSemantics.js';
import { type BindingPlan } from './wire/binding.js';
import { type OperationContract } from './wire/OperationContract.js';
import { type OperationKind } from './wire/OperationKind.js';
import type { EffectiveParameter } from './EffectiveParameter.js';
import type { EffectiveCollector } from './EffectiveCollector.js';

export interface EffectiveOperation extends OperationContract {
  /** Stable qualified identity: `blog/public/Post.publish`. */
  id: string;
  /** Human-facing identity independent of placement: `Post.publish`. */
  operation: string;
  name: string;
  kind: OperationKind;
  kindSource: 'explicit' | 'convention';
  handler: {
    className: string;
    address: string;
    filePath: string;
  };
  /** The class and method that execute after an optional operation override. */
  implementation: {
    className: string;
    address: string;
    method: string;
    filePath: string;
  };
  /** Every valid operation has a plan, including the empty plan. */
  binding: BindingPlan;
  parameters: EffectiveParameter[];
  collectors: EffectiveCollector[];
  contexts: string[];
  placement: {
    frond: string;
    runtime: 'local' | 'remote';
    remote?: string;
  };
  /**
   * What running this op reaches, and how much of that crosses a process.
   *
   * `placement` says where the op ANSWERS; this says where it GOES. The pair is what every
   * number a process hard-codes is really a function of — how often a trace is sampled, where
   * a latency histogram's bounds should sit, what a load threshold may assume. An op that
   * answers here and hops twice is not the same subject as one that answers here and hops none.
   *
   * Read from the handler, never from the op: a dependency is declared on the constructor, so
   * the crossing belongs to the CLASS. Every op of one handler reaches the same fronds, and
   * saying otherwise would dress a structural fact as a precise effect.
   */
  reach: {
    fronds: { frond: string; runtime: 'local' | 'remote' }[];
    /** How many of them are a process away — zero when everything it reaches runs here. */
    hops: number;
  };
  exposure: {
    surfaces: string[];
    adapters: string[];
  };
  /** Whether output is an explicitly closed per-operation view. */
  outputClosed: boolean;
  semantics: typeof EFFECTIVE_OPERATION_SEMANTICS;
}
