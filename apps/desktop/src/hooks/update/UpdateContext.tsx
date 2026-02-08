import { createContext, useContext } from 'react';
import type { UpdateInfo, UpdateStatus, UseUpdaterReturn } from '../useUpdater';

export type UpdateCheckSource = 'auto' | 'manual';

export type UpdateState = Pick<
  UseUpdaterReturn,
  'status' | 'updateInfo' | 'progress' | 'error' | 'downloadAndInstall' | 'restartApp'
> & {
  /** 是否为便携版 */
  isPortable: boolean;
  /** 是否存在可用更新（用于侧边栏 Badge 等） */
  hasUpdate: boolean;
  /** 最近一次检查时间（ms since epoch） */
  lastCheckedAt: number | null;
  /** 下次自动检查时间（ms since epoch） */
  nextAutoCheckAt: number | null;
  /** 主动检查更新（manual/auto），用于区分是否弹出提醒 */
  checkForUpdate: (source?: UpdateCheckSource) => Promise<void>;
  /** 控制更新 Toast */
  toastOpen: boolean;
  setToastOpen: (open: boolean) => void;
};

export const UpdateContext = createContext<UpdateState | null>(null);

export function useUpdate(): UpdateState {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error('useUpdate must be used within UpdateProvider');
  }
  return ctx;
}

export type { UpdateInfo, UpdateStatus };

