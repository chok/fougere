export interface OperationBinding {
  name: string;
  optional: boolean;
  source:
    | { kind: 'collector' | 'context' | 'fact' }
    | { kind: 'param'; name: string }
    | { kind: 'input' | 'query' };
}
