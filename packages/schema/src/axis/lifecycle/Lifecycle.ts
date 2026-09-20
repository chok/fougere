import { Format, type Accepted } from '../../lib/Format.js';
import { Generators } from './Generators.js';
import type { GeneratorRef } from './Generators.js';

export type LifecycleRules = Accepted<typeof Lifecycle.format>;
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

  /** `optional()`, a default, a generator: the rule says the value need not arrive. */
  static admitsAbsence(field: { lifecycle?: LifecycleRules }): boolean {
    return !this.of(field).requiredAtCreate();
  }

  static of(field: { lifecycle?: LifecycleRules }): Lifecycle {
    return new Lifecycle(field.lifecycle);
  }

  private get create() {
    return this.rules.create;
  }

  private get update() {
    return this.rules.update;
  }

  bornWith(instant: number): { value: unknown } | undefined {
    const rule = this.create;

    if (rule === 'now') return { value: new Date(instant) };

    if (typeof rule !== 'object') return undefined;

    if ('value' in rule) return { value: structuredClone(rule.value) };

    return { value: Generators.resolve(rule.generate)() };
  }

  requiredAtCreate(): boolean {
    return this.create === undefined;
  }

  stampedAtCreate(): boolean {
    return this.create === 'now';
  }

  immutable(): boolean {
    return this.update === 'forbidden';
  }

  stampedOnUpdate(): boolean {
    return this.update === 'now';
  }

  get literal(): { value: unknown } | undefined {
    const rule = this.create;

    return typeof rule === 'object' && rule !== null && 'value' in rule
      ? { value: (rule as { value: unknown }).value }
      : undefined;
  }
}

declare module '../../FougereFieldAxes.js' {
  interface FougereFieldAxes {
    readonly lifecycle?: LifecycleRules;
  }
}
