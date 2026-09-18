import { Format, type Admits } from '../../lib/Format.js';
import { Generators } from './Generators.js';
import type { GeneratorRef } from './Generators.js';

export type LifecycleRules = Admits<typeof Lifecycle.format>;
export class Lifecycle {
  static readonly CREATE = ['now', 'optional'] as const;
  static readonly UPDATE = ['now', 'forbidden'] as const;

  static readonly format = Format.of('axis/lifecycle')
    .key(
      'create',
      Format.either(
        Format.tokens(Lifecycle.CREATE),
        Format.exactlyOne({
          value: Format.anything,
          generate: Format.text.as<GeneratorRef>(),
        }),
      ),
    )
    .key('update', Format.tokens(Lifecycle.UPDATE))
    .closed();

  private constructor(private readonly rules: LifecycleRules = {}) {}

  static of(field: { lifecycle?: LifecycleRules }): Lifecycle {
    return new Lifecycle(field.lifecycle);
  }

  bornWith(instant: number): { value: unknown } | undefined {
    const rule = this.rules.create;

    if (rule === 'now') return { value: new Date(instant) };

    if (typeof rule !== 'object') return undefined;

    if ('value' in rule) return { value: structuredClone(rule.value) };

    return { value: Generators.resolve(rule.generate)() };
  }

  get requiredAtCreate(): boolean {
    return this.rules.create === undefined;
  }

  get stampedAtCreate(): boolean {
    return this.rules.create === 'now';
  }

  get immutable(): boolean {
    return this.rules.update === 'forbidden';
  }

  get stampedOnUpdate(): boolean {
    return this.rules.update === 'now';
  }

  get literal(): { value: unknown } | undefined {
    const rule = this.rules.create;

    return typeof rule === 'object' && rule !== null && 'value' in rule
      ? { value: (rule as { value: unknown }).value }
      : undefined;
  }
}
