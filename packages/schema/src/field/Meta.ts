import { Format, type Accepted } from '../lib/Format.js';

export const META_FORMAT = Format.of('field/meta').key('description', Format.text).closed();

export type Meta = Accepted<typeof META_FORMAT>;
