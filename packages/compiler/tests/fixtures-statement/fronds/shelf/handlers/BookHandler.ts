import { Crud } from '@fougere/core';
import Book from '../entities/Book.js';

export default class BookHandler extends Crud(Book) {}
