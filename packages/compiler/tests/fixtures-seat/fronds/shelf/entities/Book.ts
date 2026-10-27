import { entity, primary, text } from '@fougere/schema';

export default class Book extends entity({ id: primary(), title: text() }) {}
