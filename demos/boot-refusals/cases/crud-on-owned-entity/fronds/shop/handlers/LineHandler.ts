import { Crud } from '@fougere/core';
import Line from '../entities/Line.js';

/** The five gestures on an entity the aggregate owns. */
export default class LineHandler extends Crud(Line) {}
