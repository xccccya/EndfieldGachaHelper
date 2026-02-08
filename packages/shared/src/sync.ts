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
  /**
   * 最近一次“确实产生变化”的同步时间（ISO string）。
   * 变化的定义：本轮同步中有新增上传到云端，或从云端下载并落库到本地。
   *
   * 说明：用于 UI 展示“上次同步”，避免“无变化也刷新时间”导致用户误解。
   */
  lastSyncAt: string | null;
  /**
   * 最近一次“成功完成同步流程”的时间（ISO string），即使本轮无数据变化也会更新。
   * 用于增量边界推进（避免一直用很旧的时间重复筛选/重复上传）。
   */
  lastCheckedAt: string | null;
  syncError: string | null;
};

// 默认同步配置
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  user: null,
  accessToken: null,
  refreshToken: null,
  autoSync: false,
  lastSyncAt: null,
  lastCheckedAt: null,
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
  /** 可选：鹰角内部 uid（用于兼容旧云端账号键/绑定官方账号） */
  hgUid?: string;
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
  /** 可选：鹰角内部 uid（用于兼容旧云端账号键/绑定官方账号） */
  hgUid?: string;
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
  /** 可选：鹰角内部 uid（用于兼容旧云端账号键） */
  hgUid?: string;
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

// ============== 排行榜相关类型 ==============

/** 排行榜类型 */
export type LeaderboardType = 'total_pulls' | 'six_star_count' | 'off_banner_count';

/** 排行榜条目 */
export type LeaderboardEntry = {
  rank: number;
  displayUid: string;
  region: string;
  value: number;
  uidHidden: boolean;
};

/** 排行榜响应 */
export type LeaderboardResponse = {
  type: LeaderboardType;
  entries: LeaderboardEntry[];
  /** 排行榜数据的真实更新时间（后端定时任务执行时间），null 表示从未更新 */
  updatedAt: string | null;
  /** 当前用户在该榜单中的排名（如果参与且有数据） */
  myRank?: number;
  /** 当前用户在该榜单中的数值 */
  myValue?: number;
  /** 该榜单的参与总人数 */
  totalCount: number;
};

/** 所有排行榜响应 */
export type AllLeaderboardsResponse = {
  totalPulls: LeaderboardResponse;
  sixStarCount: LeaderboardResponse;
  offBannerCount: LeaderboardResponse;
};

/** 排行榜设置 */
export type LeaderboardSettings = {
  participate: boolean;
  hideUid: boolean;
};

/** 更新排行榜设置请求 */
export type UpdateLeaderboardSettingsRequest = {
  participate?: boolean;
  hideUid?: boolean;
};
