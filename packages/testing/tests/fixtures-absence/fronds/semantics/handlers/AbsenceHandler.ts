import Absence from '../entities/Absence.js';
import Presence from '../entities/Presence.js';

function observed(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return String(value);
}

export default class AbsenceHandler {
  async getBaseline(): Promise<Absence> {
    return new Absence({
      optionalOnly: 'undefined',
      requiredNullable: 'value',
      optionalNullable: 'undefined',
      ownsOptionalNullable: false,
    });
  }

  async inspect(input: Presence): Promise<Absence> {
    return new Absence({
      optionalOnly: observed(input.optionalOnly),
      requiredNullable: observed(input.requiredNullable),
      optionalNullable: observed(input.optionalNullable),
      ownsOptionalNullable: Object.hasOwn(input, 'optionalNullable'),
    });
  }
}
