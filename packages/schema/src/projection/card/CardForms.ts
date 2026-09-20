import { Registry } from '../../lib/Registry.js';
import type { CardForm } from './CardForm.js';
import { roleOnCard } from './RoleDescriptor.js';

/**
 * The axes a card writes differently from their declaration. An axis absent here travels as
 * itself, which is what `lifecycle`, `boundary` and anything registered from outside do.
 * FR : les axes qu'une carte écrit autrement que déclarés ; les autres voyagent tels quels.
 * `CardForms.register('tenancy', tenancyOnCard)`
 */
export const CardForms = new Registry<CardForm>('card form', 'call CardForms.register(name, form)', [
  ['role', roleOnCard as CardForm],
]);
