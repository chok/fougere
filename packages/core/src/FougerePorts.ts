/**
 * Each port, and the classes that extend it — a RELATION, not two lists.
 *
 * Two unions would accept `ports: { Payment: 'FileStorage' }`: both names exist, and nothing
 * would say that one does not answer the other. What the boot refuses, the type refuses first.
 */
export interface FougerePorts {}
