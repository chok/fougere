import { Repository } from '@fougere/core';
import Author from '../entities/Author.js';

export class CreateAuthorInput extends Author.omit('id') {}

/** The five operations inherited, `create` redefined with its own input — `super.create` still writes. */
export default class AuthorHandler extends Repository<Author> {
  async create(input: CreateAuthorInput) {
    console.log(`[AuthorHandler] Creating author: ${input.name}`);
    const author = await super.create(input);
    console.log(`[AuthorHandler] Author created: ${author.id}`);

    return author;
  }
}
