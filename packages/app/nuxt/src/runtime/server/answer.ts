/** Every door of the app, for each route the module mounts it on — the h3 half of `answer`. */
import { defineEventHandler, toWebRequest } from 'h3';
import { fougere } from '@fougere/app/web';
import { stateOf } from './stateOf.js';

export default defineEventHandler((event) => fougere(toWebRequest(event), { state: stateOf(event) }));
