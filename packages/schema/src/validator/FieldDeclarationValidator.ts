import { Axes } from '../axis/Axes.js';
import { Shapes } from '../axis/shape/Shape.js';
import type { Field } from '../field/Field.js';
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

    errors.push(...JsonSchemaValidator.of(Axes.fieldFormat).refusalsOf(declaration, []));

    for (const axis of Axes.all) {
      errors.push(...(axis.refusals?.(declaration[axis.slot]) ?? []));
    }

    return errors.length
      ? { success: false, errors }
      : { success: true, data: declaration as unknown as Field };
  }
}
