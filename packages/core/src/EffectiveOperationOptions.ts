import type { Diagnostic } from './diagnostic.js';

export interface EffectiveOperationOptions {
  diagnostics?: readonly Diagnostic[];
  remotes?: Record<string, string>;
  adapters?: Record<string, boolean | undefined>;
}
