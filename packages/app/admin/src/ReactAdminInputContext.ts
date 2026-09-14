import { type ReactElement } from 'react';
import { type AdminResource } from './AdminResource.js';
import { type FormField } from '@fougere/app/client';

export interface ReactAdminInputContext {
  resource: AdminResource;
  field: FormField;
  defaultRender(): ReactElement;
}
