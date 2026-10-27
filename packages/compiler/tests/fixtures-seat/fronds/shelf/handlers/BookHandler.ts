import BookRepository from '../services/BookRepository.js';

/** Two levels up — the repository that names its queries, then the base. */
export default class BookHandler extends BookRepository {}
