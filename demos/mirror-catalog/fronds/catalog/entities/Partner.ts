import { entity, url } from '@fougere/schema';

/** Where the partner answers — read from `PARTNER_URL`, the address no line of the frond writes. */
export default class Partner extends entity({
  url: url({ default: 'http://127.0.0.1:4300' }),
}) {}
