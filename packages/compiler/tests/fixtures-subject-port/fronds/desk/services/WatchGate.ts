import type Gate from './Gate.js';
import type NoteHandler from '../handlers/NoteHandler.js';

export default class WatchGate implements Partial<Gate<NoteHandler>> {
  constructor(private inner: Gate<NoteHandler>) {}
}
