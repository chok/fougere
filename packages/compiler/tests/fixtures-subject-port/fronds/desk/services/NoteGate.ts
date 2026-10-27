import Gate from './Gate.js';
import type NoteHandler from '../handlers/NoteHandler.js';

export default class NoteGate extends Gate<NoteHandler> {
  constructor(private inner: Gate<NoteHandler>) { super(); }
  pass(): string { return `note(${this.inner.pass()})`; }
}
