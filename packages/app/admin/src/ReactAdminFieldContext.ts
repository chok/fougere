import { type ReactElement } from 'react';
import { type AdminResource } from './AdminResource.js';
import { type TableColumn } from '@fougere/app/client';

export interface ReactAdminFieldContext {
  resource: AdminResource;
  column: TableColumn;
  /** The maintained Fougere renderer. Call it to wrap rather than replace it. */
  defaultRender(): ReactElement;
}
