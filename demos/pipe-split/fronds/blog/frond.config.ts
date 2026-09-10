/**
 * The order the links run in, declared by the frond that OWNS the fact.
 *
 * It is not a preference: `TenantHandler` reads the author as an id, `HashHandler`
 * replaces it with a hash. Reversed, the tenant lookup would be handed a hash.
 *
 * Two links and no order refuses the boot — nothing would say which ran first, and scan
 * order is not an answer. A frond ordering a neighbour's fact is refused too: ordering is
 * a decision about the fact, and a decision has one owner.
 */
export default { pipes: { postPublished: ['TenantHandler', 'HashHandler'] } };
