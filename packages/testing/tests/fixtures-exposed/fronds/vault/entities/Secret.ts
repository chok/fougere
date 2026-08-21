import { entity, primary, text } from '@fougere/schema';

export default class Secret extends entity({
  id: primary(),
  label: text({ min: 1 }),
}) {}
