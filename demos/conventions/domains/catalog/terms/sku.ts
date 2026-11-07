import { StringFormats } from '@fougere/schema';

export const sku = StringFormats.term('sku', (value) => /^[a-z]+-\d+$/.test(value));
