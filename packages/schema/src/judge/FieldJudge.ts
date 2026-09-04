import { EXTENSION_AXES } from '../axis/Axis.js';
import { Shapes } from '../axis/shape/Shape.js';
import type { Field } from '../field/Field.js';
import { isObject } from '../lib/utils.js';
import type { ValidationError, ValidationResult } from './result.js';

export class FieldJudge {
  private constructor(private readonly declaration: unknown) {}

  /**
   * So any value — a declaration, a card entry, a fixture — can be asked whether it is a field.
   * FR : pour que n'importe quelle valeur soit interrogée sans être déjà un champ.
   * `FieldJudge.of({ shape: { type: 'string' } }).verdict.success` → `true`
   */
  static of(declaration: unknown): FieldJudge {
    return new FieldJudge(declaration);
  }

  /**
   * So every refusal a declaration earns comes back at once, not one throw per problem.
   * FR : pour que tous les refus reviennent d'un coup, pas une exception par problème.
   * `FieldJudge.of({}).verdict`
   * → `{ success: false, errors: [{ path: 'shape', message: 'Every field states a shape — got undefined' }] }`
   */
  get verdict(): ValidationResult<Field> {
    const declaration = this.declaration;

    if (!isObject(declaration)) {
      return {
        success: false,
        errors: [
          {
            path: '.',
            message: `Expected an object — got ${JSON.stringify(declaration)}`,
          },
        ],
      };
    }

    const errors: ValidationError[] = [];

    if (!Shapes.is(declaration.shape)) {
      errors.push({
        path: 'shape',
        message: `Every field states a shape — got ${JSON.stringify(declaration.shape)}`,
      });
    }

    for (const axis of EXTENSION_AXES) {
      const declared = declaration[axis.slot];
      if (declared !== undefined) axis.judge(declared, errors);
    }

    if (declaration.meta !== undefined) {
      if (!isObject(declaration.meta)) {
        errors.push({
          path: 'meta',
          message: `Expected an object — got ${JSON.stringify(declaration.meta)}`,
        });
      } else if (
        declaration.meta.description !== undefined &&
        typeof declaration.meta.description !== 'string'
      ) {
        errors.push({ path: 'meta.description', message: 'Expected a string' });
      }
    }

    return errors.length
      ? { success: false, errors }
      : { success: true, data: declaration as unknown as Field };
  }
}
