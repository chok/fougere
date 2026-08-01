export { generateRoutes, type RouteDefinition, type HttpMethod, type GenerateRoutesOptions } from './routes.js';
export { registerRoutes } from './register.js';

// No schema endpoint here. Discovery is `rpc.discover` on the envelope — one
// surface, which answers with what the host SERVES. A second GET published
// every scanned entity instead, façade or not: the auth tables of a host that
// mounted it were readable by anyone.
