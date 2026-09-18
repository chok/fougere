import { Format, type Admits } from '../lib/Format.js';

export const META_FORMAT = Format.of('field/meta').key('description', Format.text).closed();

export type Meta = Admits<typeof META_FORMAT>;
