import { entity, primary, number } from '@fougere/schema';

/** The second domain — added, so the first one does not move. */
export default class Invoice extends entity({ id: primary(), total: number() }) {}
