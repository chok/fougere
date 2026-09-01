import { entity, primary, text } from '@fougere/schema';

/** Entity fixture — no matching BrandService (gets auto-wired Storage). */
export default class Brand extends entity({
  id: primary(),
  name: text(),
}) {}
