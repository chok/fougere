import { Generators } from './Generators.js';
import type { LifecycleRules } from './LifecycleRules.js';

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

  bornWith(instant: number): { value: unknown } | undefined {
    const rule = this.create;

    if (rule === 'now') return { value: new Date(instant) };

    if (typeof rule !== 'object') return undefined;

    if ('value' in rule) return { value: structuredClone(rule.value) };

    return { value: Generators.resolve(rule.generate)() };
  }

  get requiredAtCreate(): boolean {
    return this.create === undefined;
  }

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
}
