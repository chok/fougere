import { type FougereDataProvider } from './FougereDataProvider.js';
import { type AdminResource } from './AdminResource.js';

export interface LoadedAdmin {
  resources: AdminResource[];
  provider: FougereDataProvider;
}
