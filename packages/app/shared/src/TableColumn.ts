export interface TableColumn {
  name: string;
  /**
   * How to print the value — the dual of {@link FormField.control}, and deliberately not
   * the same list: a closed set prints as its value, a reference prints as a link.
   */
  render: 'text' | 'number' | 'boolean' | 'date' | 'json' | 'link';
  /** The same key a form uses for the same field — one convention, two projections. */
  labelKey: string;
  label: string;
  /** The entity a `link` points at, under the key its facade is named by. */
  to?: string;
}
