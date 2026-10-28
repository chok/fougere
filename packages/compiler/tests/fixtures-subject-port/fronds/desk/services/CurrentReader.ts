import { Collect, type InvocationContext } from '@fougere/core';
import type Reader from '../entities/Reader.js';

export default class CurrentReader extends Collect<Reader> {
  collect(context: InvocationContext) { return context.state.reader as Reader | undefined; }
}
