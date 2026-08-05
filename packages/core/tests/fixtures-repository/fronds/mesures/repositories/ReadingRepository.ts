import { Repository } from '../../../../../src/index.js';
import Reading from '../entities/Reading.js';

/** The queries the domain asks, named once instead of spelled at each call site. */
export default class ReadingRepository extends Repository(Reading) {
  loud(): Promise<Reading[]> {
    return this.orm.findAllBy({ loud: true }) as Promise<Reading[]>;
  }
}
