/**
 * 存储键常量
 */

/** localStorage 存储键（仅用于用户偏好，不再存储业务数据） */
export const STORAGE_KEYS = {
  /** 登录 Token（保留在 localStorage） */
  TOKEN: 'efgh.token',
  /** 登录 Token（按平台分别存储） */
  TOKEN_BY_PROVIDER_PREFIX: 'efgh.token.',
  /** 账号平台偏好（用于账号页切换默认值） */
  ACCOUNT_PROVIDER: 'efgh.accountProvider',
  /** 当前选中账号（保留在 localStorage） */
  ACTIVE_UID: 'efgh.activeUid',
  /** 侧边栏是否折叠（保留在 localStorage） */
  SIDEBAR_COLLAPSED: 'efgh.sidebarCollapsed',
  /** 本地数据 schema 版本号（用于迁移检测） */
  LOCAL_SCHEMA_VERSION: 'efgh.local_data_schema_version',
  /** 迁移完成标记 */
  MIGRATION_COMPLETED: 'efgh.sqlite_migration_completed',
  /** 窗口关闭行为偏好：'exit' | 'minimize' | null (未设置) */
  CLOSE_BEHAVIOR: 'efgh.closeBehavior',
  // 以下键已废弃，仅在迁移时使用
  /** @deprecated 旧版账号数据（迁移后删除） */
  ACCOUNTS_LEGACY: 'efgh.accounts',
  /** @deprecated 旧版角色抽卡记录（迁移后删除） */
  GACHA_RECORDS_LEGACY: 'efgh.gachaRecords',
  /** @deprecated 旧版武器抽卡记录（迁移后删除） */
  WEAPON_RECORDS_LEGACY: 'efgh.weaponRecords',
} as const;

/** 当前本地数据 schema 版本 */
export const LOCAL_DATA_SCHEMA_VERSION = 3;
