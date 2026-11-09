import { EFFECTIVE_OPERATION_SEMANTICS } from './EffectiveOperationSemantics.js';
import { type BindingPlan } from './wire/binding.js';
import { type OperationContract } from './wire/OperationContract.js';
import { type OperationKind } from './wire/OperationKind.js';
import type { EffectiveParameter } from './EffectiveParameter.js';
import type { EffectiveCollector } from './module/collector/EffectiveCollector.js';
import type { Placement } from './wire/Placement.js';
import type { FougereOperationProtocols } from './FougereOperationProtocols.js';

export interface EffectiveOperation extends OperationContract {
  /** Stable qualified identity: `blog/public/Post.publish`. */
  id: string;
  /** Human-facing identity independent of placement: `Post.publish`. */
  operation: string;
  name: string;
  kind: OperationKind;
  kindSource: 'explicit' | 'convention';
  /** What `frond.config.ts` says about this op to each protocol — read by the adapter that serves it. */
  protocols: FougereOperationProtocols;
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
  /** The frond that answers it, and where — `placement` says where it ANSWERS, `reach` where it GOES. */
  frond: string;
  placement: Placement;
  /** The address it is reached at, when it answers a process away. */
  remote?: string;
  /** The fronds this op's handler reaches, and how many of them are a process away. */
  reach: {
    fronds: { frond: string; placement: Placement }[];
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
