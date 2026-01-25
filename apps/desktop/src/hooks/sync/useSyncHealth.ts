/**
 * API 健康检查 Hook
 */

import { useCallback, useEffect, useState } from 'react';
import { syncApi } from '../../lib/syncApi';

/**
 * 检查 API 服务可用性 Hook
 */
export function useSyncHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  
  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const healthy = await syncApi.healthCheck();
      setIsHealthy(healthy);
      return healthy;
    } catch {
      setIsHealthy(false);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);
  
  // 初始化时检查
  useEffect(() => {
    void checkHealth();
    
    // 每 30 秒检查一次
    const interval = setInterval(() => {
      void checkHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);
  
  return { isHealthy, checking, checkHealth };
}
