import type { GeneratorRef } from './Generators.js';

export const CREATE_TOKENS = ['now', 'optional'] as const;
export const UPDATE_TOKENS = ['now', 'forbidden'] as const;

export interface LifecycleRules {
  create?: { value: unknown } | { generate: GeneratorRef } | (typeof CREATE_TOKENS)[number];
  update?: (typeof UPDATE_TOKENS)[number];
}

export class Lifecycle implements LifecycleRules {
  readonly create?: LifecycleRules['create'];
  readonly update?: LifecycleRules['update'];

  private constructor(rules: LifecycleRules = {}) {
    this.create = rules.create;
    this.update = rules.update;
  }

  /**
   * So the questions below are asked of the lifecycle, not of raw tokens.
   * FR : pour que les questions soient posées au cycle de vie, pas aux jetons.
   * `Lifecycle.of(createdAt).stampedOnce` → `true`
   */
  static of(field: { lifecycle?: LifecycleRules }): Lifecycle {
    return new Lifecycle(field.lifecycle);
  }

  /**
   * So a field that says nothing about creation is required, and that rule lives in one place.
   * FR : pour qu'un champ muet sur sa création soit obligatoire, et cela en un lieu.
   * `text()` → `true`; `created()` → `false`
   */
  get requiredAtCreate(): boolean {
    return this.create === undefined;
  }

  /**
   * So `created()` is told apart from `updated()`, which neither token says on its own.
   * FR : pour que `created()` se distingue d'`updated()`, ce qu'un jeton seul ne dit pas.
   * `{ create: 'now' }` → `true`; `{ create: 'now', update: 'now' }` → `false`
   */
  get stampedOnce(): boolean {
    return this.create === 'now' && this.update !== 'now';
  }

  /**
   * So a patch touching a write-once field is refused by the judge, never by the table.
   * FR : pour qu'un champ écrit-une-fois soit refusé par le juge, pas par la table.
   * `update: 'forbidden'` → `true`
   */
  get immutable(): boolean {
    return this.update === 'forbidden';
  }

  /**
   * So a storage knows which fields it must re-stamp on every write.
   * FR : pour qu'un storage sache quels champs ré-estamper à chaque écriture.
   * `updated()` → `true`
   */
  get stampedOnUpdate(): boolean {
    return this.update === 'now';
  }

  /**
   * So a declared default reads as a value, without every caller unpicking the union.
   * FR : pour qu'un défaut déclaré se lise en valeur, sans défaire l'union.
   * `create: { value: 0 }` → `{ value: 0 }`; `create: 'now'` → `undefined`
   */
  get literal(): { value: unknown } | undefined {
    const rule = this.create;
    return typeof rule === 'object' && rule !== null && 'value' in rule
      ? { value: (rule as { value: unknown }).value }
      : undefined;
  }

  /**
   * So the dual of a literal is read the same way — by name, since a generator is not a value.
   * FR : pour que le dual d'un littéral se lise par le nom, pas par la forme.
   * `create: { generate: 'cuid2' }` → `'cuid2'`
   */
  get generator(): GeneratorRef | undefined {
    const rule = this.create;
    return typeof rule === 'object' && rule !== null && 'generate' in rule
      ? (rule as { generate: GeneratorRef }).generate
      : undefined;
  }
}
