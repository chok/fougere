import type { GeneratorRef } from './Generators.js';

export const CREATE_TOKENS = ['now', 'optional'] as const;
export const UPDATE_TOKENS = ['now', 'forbidden'] as const;

export interface LifecycleRules {
  create?: { value: unknown } | { generate: GeneratorRef } | (typeof CREATE_TOKENS)[number];
  update?: (typeof UPDATE_TOKENS)[number];
}

export class Lifecycle {
  private readonly create?: LifecycleRules['create'];
  private readonly update?: LifecycleRules['update'];

  private constructor(rules: LifecycleRules = {}) {
    this.create = rules.create;
    this.update = rules.update;
  }

  static of(field: { lifecycle?: LifecycleRules }): Lifecycle {
    return new Lifecycle(field.lifecycle);
  }

  get requiredAtCreate(): boolean {
    return this.create === undefined;
  }

  /** The server fills it at create, so a client form never carries it. */
  get stampedAtCreate(): boolean {
    return this.create === 'now';
  }

  get stampedOnce(): boolean {
    return this.stampedAtCreate && !this.stampedOnUpdate;
  }

  get immutable(): boolean {
    return this.update === 'forbidden';
  }

  get stampedOnUpdate(): boolean {
    return this.update === 'now';
  }

  get literal(): { value: unknown } | undefined {
    const rule = this.create;
    return typeof rule === 'object' && rule !== null && 'value' in rule
      ? { value: (rule as { value: unknown }).value }
      : undefined;
  }

  get generator(): GeneratorRef | undefined {
    const rule = this.create;
    return typeof rule === 'object' && rule !== null && 'generate' in rule
      ? (rule as { generate: GeneratorRef }).generate
      : undefined;
  }
}
