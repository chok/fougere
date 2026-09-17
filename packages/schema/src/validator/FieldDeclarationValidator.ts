import { EXTENSION_AXES } from '../axis/Axis.js';
import { Shapes } from '../axis/shape/Shape.js';
import type { Field } from '../field/Field.js';
import { META_FORMAT } from '../field/Meta.js';
import { isObject, shown } from '../lib/utils.js';
import type { ValidationError } from '../lib/ValidationError.js';
import type { ValidationResult } from '../lib/ValidationResult.js';
import { JsonSchemaValidator } from './JsonSchemaValidator.js';

export class FieldDeclarationValidator {
  private constructor(private readonly declaration: unknown) {}

  static of(declaration: unknown): FieldDeclarationValidator {
    return new FieldDeclarationValidator(declaration);
  }

  get verdict(): ValidationResult<Field> {
    const declaration = this.declaration;

    if (!isObject(declaration)) {
      return {
        success: false,
        errors: [
          {
            path: [],
            message: `Expected an object — got ${shown(declaration)}`,
          },
        ],
      };
    }

    const errors: ValidationError[] = [];

    if (!Shapes.is(declaration.shape)) {
      errors.push({
        path: ['shape'],
        message: `Every field states a shape — got ${shown(declaration.shape)}`,
      });
    }

    for (const axis of EXTENSION_AXES) {
      const declared = declaration[axis.slot];
      if (declared === undefined) continue;

      const refusal = JsonSchemaValidator.of(axis.format).refusalOf(declared, [axis.slot]);
      if (refusal) errors.push(refusal);

      errors.push(...(axis.refusals?.(declared) ?? []));
    }

    if (declaration.meta !== undefined) {
      const refusal = JsonSchemaValidator.of(META_FORMAT).refusalOf(declaration.meta, ['meta']);
      if (refusal) errors.push(refusal);
    }

    return errors.length
      ? { success: false, errors }
      : { success: true, data: declaration as unknown as Field };
  }
}
