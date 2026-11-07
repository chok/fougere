import { Registry } from '@fougere/registry';
import type { CardForm } from './CardForm.js';
import { roleOnCard } from './RoleDescriptor.js';

/**
 * The axes a card writes differently from their declaration.
 * Ex: `CardForms.register('tenancy', tenancyOnCard)`.
 */
export const CardForms = new Registry<CardForm>('card form', 'call CardForms.register(name, form)', [
  ['role', roleOnCard as CardForm],
]);
