export interface AdminOperationExtension {
  label?: string;
  /** `false` explicitly removes a confirmation added by an earlier extension. */
  confirm?: string | false;
}
