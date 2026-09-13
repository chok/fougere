import { Repository } from '@fougere/core';
import Line from '../entities/Line.js';

/** One member, so it IS line's storage and forwards every gesture. */
export default class LineRepository extends Repository(Line) {}
