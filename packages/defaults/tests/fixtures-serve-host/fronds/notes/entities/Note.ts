import { entity, primary, text } from '@fougere/schema';

export default class Note extends entity({ id: primary(), title: text() }) {}
