import { Crud } from '@fougere/core';
import Note from '../entities/Note.js';

/**
 * The shape the scaffold ships: everything inherited, nothing declared.
 *
 * The import is by PACKAGE NAME on purpose — that is what an installed app
 * writes, and the AST parser cannot resolve it (it looks for
 * `<projectRoot>/packages/core/src`, which only exists inside this monorepo).
 * So the scan finds zero operations here, exactly as in a real project.
 */
export default class NoteHandler extends Crud(Note) {}
