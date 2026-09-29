export { type EntityClass } from '../EntityClass.js';
export { type CallInput } from '../CallInput.js';
export { type Fetcher } from '../Fetcher.js';
export {
  type Designation,
  CALL_ENDPOINT,
  addressOf,
  asFougereError,
  callOf,
  entityKeyOf,
  facade,
  facadeOf,
  fetcher,
  invocationOf,
  itemsOf,
  mountedKeys,
  onRefetch,
  pageOf,
  queryKeyOf,
  revalidate,
  sendCall,
  trackQuery,
} from '../Designation.js';

export type {
  Addresses,
  Answer,
  AnyHandler,
  FacadeName,
  FougereHandlers,
  FougereOperations,
  HandlerOf,
  Refused,
  Rows,
} from '@fougere/core/contract';

// The form contract is host-independent too, and a form is client code — so it
// reaches the browser through this subpath rather than through the package root,
// which carries the boot.
export { errorsByField, formFieldsOf, payloadOf, tableColumnsOf, type FormEntity } from '../FormEntity.js';
export { type FormRow, type FormValues, type FormErrors, type FormFieldName } from '../FormRow.js';
export { type FormField, type FormReference } from '../FormField.js';
export { Choices, type Choice } from '../Choices.js';
export { cellOf, summaryOf, type Summary } from '../Summary.js';
export { type TableColumn } from '../TableColumn.js';
export { sessionViewOf, type SessionView } from '../session.js';
