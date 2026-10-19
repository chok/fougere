import { LineMiddleware, type Answer } from '../../../door.js';
import NoteHandler from '../handlers/NoteHandler.js';

/** Behind an alias — the reading holds, since it reads the fields. */
type Moved = Answer<301 | 308, { location: string }>;

export default class NoteGate extends LineMiddleware(NoteHandler) {
  async findById(_request: unknown, next: () => Promise<Answer>): Promise<Answer | Moved> {
    return next();
  }

  async delete(_request: unknown, next: () => Promise<Answer>): Promise<Answer | Answer<423>> {
    return next();
  }

  async list(_request: unknown, next: () => Promise<Answer>): Promise<Answer> {
    return next();
  }
}
