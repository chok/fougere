/** `@fougere/next` — what is Next about hosting a Fougere app, and nothing else. */
export { invoke, getSession } from './invoke.js';


export {
  configureFougere,
  useFougereApp,
  useFougereAuth,
  stateFor,
  type FougereServerConfig,
  type SessionView,
} from '@fougere/app';
