import { Crud } from '@fougere/core';
import Author from '../../entities/Author.js';

/** Public output — no email. */
export class AuthorPublic extends Author.pick('id', 'name') {}

export default class AuthorHandler extends Crud(Author, AuthorPublic) {}
