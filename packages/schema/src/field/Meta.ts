import { Format } from '../lib/Format.js';

export interface Meta {
  description?: string;
}

export const META_FORMAT = Format.of('field/meta').key('description', Format.text).closed();
