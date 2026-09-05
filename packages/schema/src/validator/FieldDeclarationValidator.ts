import { EXTENSION_AXES } from '../axis/Axis.js';
import { Shapes } from '../axis/shape/Shape.js';
import type { Field } from '../field/Field.js';
import { isObject } from '../lib/utils.js';
import type { ValidationError, ValidationResult } from '../validation.js';

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
      if (declared !== undefined) axis.validator(declared, errors);
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
