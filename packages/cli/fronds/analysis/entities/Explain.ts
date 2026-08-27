import { bool, entity, oneOf, optional, text } from '@fougere/schema';

/** `fougere explain <Operation>` — print the operation contract Fougere will serve. */
export default class Explain extends entity({
  operation: text({ min: 1, description: 'Operation to inspect (e.g. Post.publish)' }),
  root: optional(text({ description: 'Project to read. Default: the current directory' })),
  json: bool({ default: false, description: 'Print stable machine-readable JSON' }),
  names: optional(oneOf('operations', 'fronds', { description: 'Print one name per line — what shell completion reads' })),
}) {}
