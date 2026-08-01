import { entity, primary, text } from '@fougere/schema';

export default class Tag extends entity({ id: primary(), label: text() }) {}
