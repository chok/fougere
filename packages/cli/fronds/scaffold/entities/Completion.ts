import { entity, oneOf } from '@fougere/schema';

export default class Completion extends entity({
  shell: oneOf('zsh', 'bash', { description: 'Shell type (default: auto-detect)' }),
}) {}
