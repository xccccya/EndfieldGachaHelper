/**
 * 云同步相关类型定义
 */

import type { GachaCategory } from './endfield';

// 重新导出以便外部使用
export type { GachaCategory };

// 同步用户信息
export type SyncUser = {
  id: string;
  email: string;
  createdAt?: string;
};

// 登录/注册响应
export type AuthResponse = {
  user: SyncUser;
  accessToken: string;
  refreshToken: string;
};

// Token 刷新响应
export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

// 通用操作响应
export type OkResponse = {
  ok: boolean;
  message?: string;
};

// 检查邮箱响应
export type CheckEmailResponse = {
  registered: boolean;
};

// 同步状态
export type SyncStatus = 
  | 'not_logged_in'     // 未登录同步账号
  | 'disabled'          // 已登录但未启用同步
  | 'enabled'           // 已启用同步
  | 'syncing'           // 正在同步中
  | 'error';            // 同步服务连接异常

// 本地存储的同步配置
export type SyncConfig = {
  user: SyncUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  autoSync: boolean;
  lastSyncAt: string | null;  // ISO string
  syncError: string | null;
};

// 默认同步配置
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  user: null,
  accessToken: null,
  refreshToken: null,
  autoSync: false,
  lastSyncAt: null,
  syncError: null,
};

// API 请求类型
export type SendCodeRequest = {
  email: string;
  type: 'register' | 'reset';
};

export type RegisterRequest = {
  email: string;
  password: string;
  code: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ResetPasswordRequest = {
  email: string;
  code: string;
  newPassword: string;
};

export type RefreshRequest = {
  refreshToken: string;
};

export type LogoutRequest = {
  refreshToken: string;
};

// ============== 同步数据相关类型 ==============

/** 云端抽卡记录（统一格式） */
export type CloudGachaRecord = {
  recordUid: string;
  category: GachaCategory;
  poolId: string;
  poolName: string;
  itemId: string;
  itemName: string;
  rarity: number;
  isNew: boolean;
  gachaTs: string;
  seqId: string;
  fetchedAt: number;
  // 角色特有
  isFree?: boolean;
  // 武器特有
  weaponType?: string;
};

/** 游戏账号信息 */
export type GameAccountInfo = {
  id: string;
  uid: string;
  region: string;
  createdAt: string;
  updatedAt: string;
};

/** 创建游戏账号请求 */
export type CreateGameAccountRequest = {
  uid: string;
  region: string;
};

/** 游戏账号响应 */
export type GameAccountResponse = {
  account: GameAccountInfo;
};

/** 游戏账号列表响应 */
export type GameAccountListResponse = {
  accounts: GameAccountInfo[];
};

/** 上传同步数据请求 */
export type SyncUploadRequest = {
  uid: string;
  region: string;
  records: CloudGachaRecord[];
};

/** 上传同步数据响应 */
export type SyncUploadResponse = {
  uploaded: number;
  skipped: number;
  total: number;
};

/** 下载同步数据请求参数 */
export type SyncDownloadParams = {
  uid: string;
  region: string;
  category?: GachaCategory;
  since?: string; // ISO date string，只获取此时间后的记录
};

/** 下载同步数据响应 */
export type SyncDownloadResponse = {
  records: CloudGachaRecord[];
  total: number;
  lastSyncAt: string;
};

/** 同步状态信息 */
export type SyncStatusInfo = {
  uid: string;
  region: string;
  characterCount: number;
  weaponCount: number;
  lastRecordAt: string | null;
};

/** 获取同步状态响应 */
export type SyncStatusResponse = {
  accounts: SyncStatusInfo[];
};
