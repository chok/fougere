import { Axes } from '../axis/Axes.js';
import type { Field } from '../field/Field.js';
import { isObject } from '../lib/utils.js';
import { SchemaError } from '../SchemaError.js';
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
            message: `Expected an object — got ${SchemaError.inspect(declaration)}`,
          },
        ],
      };
    }

    const errors: ValidationError[] = [];

    if (declaration.shape === undefined) {
      errors.push({ path: ['shape'], message: 'Every field states a shape' });
    }

    errors.push(...JsonSchemaValidator.of(Axes.fieldFormat).refusalsOf(declaration, []));

    for (const [name, axis] of Axes.entries) {
      errors.push(...(axis.refusals?.(declaration[name], declaration) ?? []));
    }

    return errors.length
      ? { success: false, errors }
      : { success: true, data: declaration as unknown as Field };
  }
}
