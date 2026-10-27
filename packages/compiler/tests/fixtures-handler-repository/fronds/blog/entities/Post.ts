import { entity, oneOf, primary, text } from '@fougere/schema';

export default class Post extends entity({ id: primary(), title: text(), status: oneOf('draft', 'published', { default: 'draft' }) }) {}
