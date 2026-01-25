/**
 * Storage 模块类型定义
 */

import type {
  EndFieldCharInfo,
  EndFieldWeaponInfo,
  GameRole,
  GachaCategory,
} from '@efgachahelper/shared';

// ============== 账号类型 ==============

/**
 * 本地存储的账号信息
 */
export type StoredAccount = {
  /**
   * 本地账号主键：
   * 使用 accountKey = `${serverId}:${roleId}`，确保多服/多角色不冲突，且不受 hgUid 变动影响。
   */
  uid: string;
  /** 鹰角内部 uid：用于官方接口换取 u8_token（云端恢复时可能为空，需要重新绑定补全） */
  hgUid?: string;
  /** 玩家可见 UID（即 roleId）。云端恢复/展示时优先使用。 */
  roleId?: string;
  /** 区服 ID（即 serverId）。云端恢复/展示/云同步时优先使用。 */
  serverId?: string;
  channelName: string;
  roles: GameRole[];
  addedAt: number;
};

// ============== 抽卡记录类型 ==============

/** 角色抽卡记录 */
export type GachaRecord = EndFieldCharInfo & {
  uid: string;
  recordUid: string; // 用于去重的唯一标识
  fetchedAt: number;
  category: 'character'; // 记录类型
};

/** 武器抽卡记录 */
export type WeaponRecord = EndFieldWeaponInfo & {
  uid: string;
  recordUid: string;
  fetchedAt: number;
  category: 'weapon';
};

/** 通用抽卡记录（角色或武器） */
export type UnifiedGachaRecord = {
  uid: string;
  recordUid: string;
  fetchedAt: number;
  category: GachaCategory;
  // 通用字段
  poolId: string;
  poolName: string;
  rarity: number;
  isNew: boolean;
  gachaTs: string;
  seqId: string;
  // 角色特有字段
  charId?: string;
  charName?: string;
  isFree?: boolean;
  // 武器特有字段
  weaponId?: string;
  weaponName?: string;
  weaponType?: string;
  // 统一名称（用于显示）
  itemName: string;
};

// ============== 统计类型 ==============

export type GachaStats = {
  total: number;
  byRarity: Record<number, number>;
  byPool: Record<string, number>;
  last6Star?: UnifiedGachaRecord | undefined;
  pity: number; // 当前保底计数
};

// ============== 导出导入类型 ==============

export type ExportData = {
  schemaVersion: 2;
  exportedAt: number;
  accounts: StoredAccount[];
  records: GachaRecord[];
  weaponRecords: WeaponRecord[];
};

/** 旧版本导出数据格式 */
export type ExportDataV1 = {
  schemaVersion: 1;
  exportedAt: number;
  accounts: StoredAccount[];
  records: GachaRecord[];
};

// ============== 存储变更事件类型 ==============

export type StorageChangeDetail = {
  at: number;
  /** 可选：变更原因（调试用） */
  reason?: string;
  /** 可选：涉及的 key（调试用） */
  keys?: string[];
};
