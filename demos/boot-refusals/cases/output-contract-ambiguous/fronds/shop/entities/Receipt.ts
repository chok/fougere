import { entity, primary, text } from '@fougere/schema';

export default class Receipt extends entity({ id: primary(), reference: text() }) {}
