import { Crud } from '@fougere/core';
import Author from '../entities/Author.js';

export class CreateAuthorInput extends Author.omit('id') {}

/**
 * Full CRUD inherited — `create` redefined with typed custom logic. No `override`
 * modifier: the mixin declares its five ops at runtime, not on the type, so the
 * redefinition carries its own signature (see `CrudBase`).
 */
export default class AuthorHandler extends Crud(Author) {
  async create(input: CreateAuthorInput) {
    console.log(`[AuthorHandler] Creating author: ${input.name}`);
    const author = await this.storage.create(input);
    console.log(`[AuthorHandler] Author created: ${author.id}`);
    return author;
  }
}
