import { Format } from '../../lib/Format.js';
import { Generators } from './Generators.js';
import type { GeneratorRef } from './Generators.js';

export interface LifecycleRules {
  create?: { value: unknown } | { generate: GeneratorRef } | (typeof Lifecycle.CREATE)[number];
  update?: (typeof Lifecycle.UPDATE)[number];
}

export class Lifecycle {
  static readonly CREATE = ['now', 'optional'] as const;
  static readonly UPDATE = ['now', 'forbidden'] as const;

  static readonly format = Format.of('axis/lifecycle')
    .key(
      'create',
      Format.either(
        Format.tokens(Lifecycle.CREATE),
        Format.exactlyOne({ value: Format.anything, generate: Format.text }),
      ),
    )
    .key('update', Format.tokens(Lifecycle.UPDATE))
    .closed();

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
