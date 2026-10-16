import { Format } from '../../lib/Format.js';
import { word } from '../../field/Word.js';
import type { StringFormat } from '../../axis/shape/StringFormat.js';

/** `text({ min: 1, max: 160 })` → `{ type: 'string', minLength: 1, maxLength: 160 }` */
export const text = word<string>()('text', { type: 'string' }, {
  min: ['minLength', Format.count],
  max: ['maxLength', Format.count],
  pattern: ['pattern', Format.text],
  format: ['format', Format.text.as<StringFormat>()],
});

export type TextOptions = NonNullable<Parameters<typeof text>[0]>;
