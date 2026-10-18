import { Crud } from '@fougere/core';
import Book from '../entities/Book.ts';

export default class BookHandler extends Crud(Book) {}
