import { type ComponentType } from 'react';

export interface ReactAdminResourceComponents {
  list?: ComponentType;
  show?: ComponentType;
  edit?: ComponentType;
  create?: ComponentType;
  icon?: ComponentType;
}
