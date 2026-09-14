import type { PresenterViews } from '../prefab/presenter.js';
import type { PresenterFieldMeta } from './PresenterFieldMeta.js';

/** A discovered presenter (computed fields for an entity's output). */
export interface PresenterEntry {
  /** Entity name this presenter enriches (e.g. 'post' from PostPresenter). */
  entityName: string;
  /** The presenter class. */
  ctor: new (...args: never[]) => unknown;
  /** Computed field names (method names on prototype). */
  fields: string[];
  /** Per-field type metadata (inferred from source via parser). */
  fieldMeta: PresenterFieldMeta[];
  /**
   * The view each computed field emits, when the presenter declares one (`Presenter(Order, {
   * items: [OrderItemView] })`).
   */
  views?: PresenterViews;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}
