import type { Subject } from './descriptor/Subject.js';

/** What a subject needs beyond its class, when its constructor names a frame or a port. */
export type DeclaredSubject = Pick<Subject, 'ctor'> & Partial<Pick<Subject, 'deps'>>;
