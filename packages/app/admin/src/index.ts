/** `@fougere/admin` — a back-office that states no rule of its own. */
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
  fetchTopology,
  nodesOf,
  isOpaque,
  type TopologyReport,
  type TopologyNode,
  type FrondPlacement,
  type Edge,
} from './topology.js';
export {
  createAdminRuntime,
  type AdminRuntime,
  type AdminRuntimeOptions,
  type LoadedAdmin,
} from './runtime.js';
