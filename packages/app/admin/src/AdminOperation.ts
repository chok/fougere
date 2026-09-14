import { type CardOp } from '@fougere/core/contract';

/** One operation as the admin meets it, before a renderer decides its widget. */
export interface AdminOperation extends CardOp {
  /** Display fallback. An extension may replace it without renaming the call. */
  label: string;
  /** Optional confirmation sentence, interpreted by renderers that support actions. */
  confirm?: string;
}
