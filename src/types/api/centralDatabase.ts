/**
 * Type declarations for window.centralDatabaseAPI
 */

import type { CentralDatabaseAPI } from '../../preload/apis/centralDatabase';

declare global {
  interface Window {
    centralDatabaseAPI: CentralDatabaseAPI;
  }
}
