import { Crud } from '@fougere/core';
import Author from '../entities/Author.js';

export class CreateAuthorInput extends Author.omit('id') {}

/** Full CRUD inherited — create overridden with typed custom logic. */
export default class AuthorHandler extends Crud(Author) {
  override async create(input: CreateAuthorInput) {
    console.log(`[AuthorHandler] Creating author: ${input.name}`);
    const author = await this.orm.create(input);
    console.log(`[AuthorHandler] Author created: ${author.id}`);
    return author;
  }
}
