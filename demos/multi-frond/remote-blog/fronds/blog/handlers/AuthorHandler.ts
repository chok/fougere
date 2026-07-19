import { Crud } from '@fougere/core';
import Author from '../entities/Author.js';

export default class AuthorHandler extends Crud(Author) {}
