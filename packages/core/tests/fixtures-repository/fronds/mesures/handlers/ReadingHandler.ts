import Reading from '../entities/Reading.js';
import ReadingRepository from '../repositories/ReadingRepository.js';

/** Asks the question; never spells the storage. */
export default class ReadingHandler {
  constructor(private readingRepository: ReadingRepository) {}

  async loud() { return this.readingRepository.loud(); }
}
