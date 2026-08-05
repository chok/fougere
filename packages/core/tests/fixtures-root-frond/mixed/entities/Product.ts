import { entity, primary, text } from '@fougere/schema';

/** Stays at the root when a second domain appears under `fronds/`. */
export default class Product extends entity({ id: primary(), name: text() }) {}
