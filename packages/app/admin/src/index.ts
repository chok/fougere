/**
 * `@fougere/admin` — a back-office that states no rule of its own.
 *
 * It reads the identity card and renders what the card says: the doors are the menu,
 * the schema is the columns and the form, the ops are the buttons. Nothing here
 * knows an entity by name, which is why a new one needs no code — and why the same
 * build serves a frond running in this process and one behind `remotes:`.
 *
 * Two layers, kept apart because they do not test the same way and because only the
 * first is derivable: this module is the contract, `./react` is the rendering. That
 * is the line `useFormFor` already draws.
 */
export {
  createDataProvider,
  createLazyDataProvider,
  type FougereDataProvider,
  type ProviderOptions,
  type ResourceKey,
} from './provider.js';
export {
  resourcesOf,
  keysOf,
  fetchCard,
  capabilitiesOf,
  actionsOf,
  CRUD_OPS,
  type AdminOperation,
  type AdminResource,
} from './resources.js';
export {
  defineAdminFacet,
  mergeAdminFacets,
  type AdminFacetRegistry,
  type AdminFacets,
  type EditorialFacet,
  type UsersFacet,
} from './facets.js';
export {
  applyAdminExtensions,
  defineAdminExtension,
  type AdminExtension,
  type AdminFieldExtension,
  type AdminOperationExtension,
} from './extensions.js';
export {
  createAdminRuntime,
  type AdminRuntime,
  type AdminRuntimeOptions,
  type LoadedAdmin,
} from './runtime.js';
