/**
 * The order the links run in, declared by the frond that OWNS the fact.
 *
 * Two links and no order refuses the boot: nothing would say which finished it, and scan
 * order is not an answer. Ordering is a decision about the fact, so it has one owner —
 * a frond ordering a neighbour's fact is refused too.
 */
export default { pipes: { postPublished: ['RedactHandler', 'StampHandler'] } };
