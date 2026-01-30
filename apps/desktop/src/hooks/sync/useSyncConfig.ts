/**
 * 同步配置状态 Hook
 */

import { useMemo, useSyncExternalStore } from 'react';
import { getSyncConfig, getSyncStatus, subscribeSyncConfig } from './config';

/**
 * 同步状态 Hook
 */
export function useSyncConfig() {
  const config = useSyncExternalStore(
    subscribeSyncConfig,
    getSyncConfig,
    getSyncConfig,
  );
  
  const status = useMemo(() => getSyncStatus(config), [config]);
  
  return {
    config,
    status,
    user: config.user,
    isLoggedIn: !!config.user && !!config.accessToken,
    accessToken: config.accessToken,
    autoSync: config.autoSync,
    lastSyncAt: config.lastSyncAt,
    lastCheckedAt: config.lastCheckedAt,
    syncError: config.syncError,
  };
}
