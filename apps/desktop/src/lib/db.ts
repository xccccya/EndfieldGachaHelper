/**
 * SQLite 数据库管理
 * 使用 Tauri SQL 插件进行本地数据持久化
 */

import Database from '@tauri-apps/plugin-sql';

// 数据库实例
let db: Database | null = null;

// 数据库名称
const DB_NAME = 'sqlite:efgacha.db';

/**
 * 获取数据库实例
 */
export async function getDB(): Promise<Database> {
  if (db) return db;
  
  db = await Database.load(DB_NAME);
  await initTables();
  return db;
}

/**
 * 初始化数据库表结构
 */
async function initTables(): Promise<void> {
  if (!db) return;
  
  // 账号表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      uid TEXT PRIMARY KEY,
      hg_uid TEXT,
      channel_name TEXT NOT NULL,
      roles TEXT NOT NULL,
      added_at INTEGER NOT NULL
    )
  `);

  // 数据库升级：为旧版本 accounts 表补齐 hg_uid 列
  await ensureAccountsSchema();
  
  // 角色抽卡记录表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS gacha_records (
      record_uid TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      pool_id TEXT NOT NULL,
      pool_name TEXT NOT NULL,
      char_id TEXT NOT NULL,
      char_name TEXT NOT NULL,
      rarity INTEGER NOT NULL,
      is_new INTEGER NOT NULL,
      is_free INTEGER NOT NULL,
      gacha_ts TEXT NOT NULL,
      seq_id TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'character',
      FOREIGN KEY (uid) REFERENCES accounts(uid)
    )
  `);
  
  // 武器抽卡记录表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS weapon_records (
      record_uid TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      pool_id TEXT NOT NULL,
      pool_name TEXT NOT NULL,
      weapon_id TEXT NOT NULL,
      weapon_name TEXT NOT NULL,
      weapon_type TEXT NOT NULL,
      rarity INTEGER NOT NULL,
      is_new INTEGER NOT NULL,
      gacha_ts TEXT NOT NULL,
      seq_id TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'weapon',
      FOREIGN KEY (uid) REFERENCES accounts(uid)
    )
  `);
  
  // 创建索引
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_gacha_uid ON gacha_records(uid)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_gacha_ts ON gacha_records(gacha_ts)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_weapon_uid ON weapon_records(uid)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_weapon_ts ON weapon_records(gacha_ts)
  `);
}

/**
 * 确保 accounts 表结构包含 hg_uid 列（用于换取 u8_token）。
 * 旧版本表结构缺少该列，会导致 hgUid 无法持久化，从而同步失败。
 */
async function ensureAccountsSchema(): Promise<void> {
  if (!db) return;
  try {
    const columns = await db.select<{ name: string }[]>('PRAGMA table_info(accounts)');
    const hasHgUid = columns.some((c) => c?.name === 'hg_uid');
    if (!hasHgUid) {
      await db.execute('ALTER TABLE accounts ADD COLUMN hg_uid TEXT');
    }
  } catch (e) {
    // 保底：避免因为迁移失败导致整个应用无法启动
    console.error('[db] ensureAccountsSchema failed:', e);
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDB(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

/**
 * 清理本地数据库中的重复记录
 * 按 seq_id 去重，保留最早创建的一条
 */
export async function cleanupLocalDuplicates(): Promise<{ charDeleted: number; weaponDeleted: number }> {
  const database = await getDB();
  let charDeleted = 0;
  let weaponDeleted = 0;

  try {
    // 清理角色记录重复
    // 找出所有重复的 seq_id
    const charDuplicates = await database.select<{ seq_id: string; cnt: number }[]>(
      `SELECT seq_id, COUNT(*) as cnt FROM gacha_records GROUP BY uid, seq_id HAVING cnt > 1`
    );
    
    for (const dup of charDuplicates) {
      // 获取该 seq_id 的所有记录，按 record_uid 排序（保留第一条）
      const records = await database.select<{ record_uid: string }[]>(
        `SELECT record_uid FROM gacha_records WHERE seq_id = $1 ORDER BY record_uid`,
        [dup.seq_id]
      );
      
      if (records.length > 1) {
        // 删除除第一条外的所有记录
        const toDelete = records.slice(1).map(r => r.record_uid);
        for (const recordUid of toDelete) {
          await database.execute(
            `DELETE FROM gacha_records WHERE record_uid = $1`,
            [recordUid]
          );
          charDeleted++;
        }
      }
    }

    // 清理武器记录重复
    const weaponDuplicates = await database.select<{ seq_id: string; cnt: number }[]>(
      `SELECT seq_id, COUNT(*) as cnt FROM weapon_records GROUP BY uid, seq_id HAVING cnt > 1`
    );
    
    for (const dup of weaponDuplicates) {
      const records = await database.select<{ record_uid: string }[]>(
        `SELECT record_uid FROM weapon_records WHERE seq_id = $1 ORDER BY record_uid`,
        [dup.seq_id]
      );
      
      if (records.length > 1) {
        const toDelete = records.slice(1).map(r => r.record_uid);
        for (const recordUid of toDelete) {
          await database.execute(
            `DELETE FROM weapon_records WHERE record_uid = $1`,
            [recordUid]
          );
          weaponDeleted++;
        }
      }
    }
  } catch (e) {
    console.error('清理本地重复记录失败:', e);
  }

  return { charDeleted, weaponDeleted };
}

// ============== 账号操作 ==============

export type DBAccount = {
  uid: string;
  hg_uid: string | null;
  channel_name: string;
  roles: string; // JSON string
  added_at: number;
};

/**
 * 获取所有账号
 */
export async function dbGetAccounts(): Promise<DBAccount[]> {
  const database = await getDB();
  return await database.select<DBAccount[]>(
    'SELECT uid, hg_uid, channel_name, roles, added_at FROM accounts ORDER BY added_at DESC',
  );
}

/**
 * 保存账号（插入或更新）
 */
export async function dbSaveAccount(account: DBAccount): Promise<void> {
  const database = await getDB();
  await database.execute(
    `INSERT OR REPLACE INTO accounts (uid, hg_uid, channel_name, roles, added_at) VALUES ($1, $2, $3, $4, $5)`,
    [account.uid, account.hg_uid, account.channel_name, account.roles, account.added_at],
  );
}

/**
 * 删除账号
 */
export async function dbRemoveAccount(uid: string): Promise<void> {
  const database = await getDB();
  await database.execute('DELETE FROM accounts WHERE uid = $1', [uid]);
}

// ============== 角色抽卡记录操作 ==============

export type DBGachaRecord = {
  record_uid: string;
  uid: string;
  pool_id: string;
  pool_name: string;
  char_id: string;
  char_name: string;
  rarity: number;
  is_new: number; // SQLite boolean
  is_free: number;
  gacha_ts: string;
  seq_id: string;
  fetched_at: number;
  category: string;
};

/**
 * 获取角色抽卡记录
 */
export async function dbGetGachaRecords(uid?: string): Promise<DBGachaRecord[]> {
  const database = await getDB();
  if (uid) {
    return await database.select<DBGachaRecord[]>(
      'SELECT * FROM gacha_records WHERE uid = $1 ORDER BY gacha_ts DESC',
      [uid]
    );
  }
  return await database.select<DBGachaRecord[]>(
    'SELECT * FROM gacha_records ORDER BY gacha_ts DESC'
  );
}

/**
 * 批量保存角色抽卡记录
 * @returns 实际新增的记录数量（不包括因主键冲突被忽略的记录）
 */
export async function dbSaveGachaRecords(records: DBGachaRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  
  const database = await getDB();
  let added = 0;
  
  for (const record of records) {
    try {
      const result = await database.execute(
        `INSERT OR IGNORE INTO gacha_records 
         (record_uid, uid, pool_id, pool_name, char_id, char_name, rarity, is_new, is_free, gacha_ts, seq_id, fetched_at, category) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          record.record_uid, record.uid, record.pool_id, record.pool_name,
          record.char_id, record.char_name, record.rarity, record.is_new,
          record.is_free, record.gacha_ts, record.seq_id, record.fetched_at, record.category
        ]
      );
      // INSERT OR IGNORE 成功插入时 rowsAffected 为 1，被忽略时为 0
      if (result.rowsAffected > 0) {
        added++;
      }
    } catch {
      // 其他数据库错误，忽略该条记录
    }
  }
  
  return added;
}

/**
 * 清除指定 UID 的角色抽卡记录
 */
export async function dbClearGachaRecords(uid: string): Promise<void> {
  const database = await getDB();
  await database.execute('DELETE FROM gacha_records WHERE uid = $1', [uid]);
}

// ============== 武器抽卡记录操作 ==============

export type DBWeaponRecord = {
  record_uid: string;
  uid: string;
  pool_id: string;
  pool_name: string;
  weapon_id: string;
  weapon_name: string;
  weapon_type: string;
  rarity: number;
  is_new: number;
  gacha_ts: string;
  seq_id: string;
  fetched_at: number;
  category: string;
};

/**
 * 获取武器抽卡记录
 */
export async function dbGetWeaponRecords(uid?: string): Promise<DBWeaponRecord[]> {
  const database = await getDB();
  if (uid) {
    return await database.select<DBWeaponRecord[]>(
      'SELECT * FROM weapon_records WHERE uid = $1 ORDER BY gacha_ts DESC',
      [uid]
    );
  }
  return await database.select<DBWeaponRecord[]>(
    'SELECT * FROM weapon_records ORDER BY gacha_ts DESC'
  );
}

/**
 * 批量保存武器抽卡记录
 * @returns 实际新增的记录数量（不包括因主键冲突被忽略的记录）
 */
export async function dbSaveWeaponRecords(records: DBWeaponRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  
  const database = await getDB();
  let added = 0;
  
  for (const record of records) {
    try {
      const result = await database.execute(
        `INSERT OR IGNORE INTO weapon_records 
         (record_uid, uid, pool_id, pool_name, weapon_id, weapon_name, weapon_type, rarity, is_new, gacha_ts, seq_id, fetched_at, category) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          record.record_uid, record.uid, record.pool_id, record.pool_name,
          record.weapon_id, record.weapon_name, record.weapon_type, record.rarity,
          record.is_new, record.gacha_ts, record.seq_id, record.fetched_at, record.category
        ]
      );
      // INSERT OR IGNORE 成功插入时 rowsAffected 为 1，被忽略时为 0
      if (result.rowsAffected > 0) {
        added++;
      }
    } catch {
      // 其他数据库错误，忽略该条记录
    }
  }
  
  return added;
}

/**
 * 清除指定 UID 的武器抽卡记录
 */
export async function dbClearWeaponRecords(uid: string): Promise<void> {
  const database = await getDB();
  await database.execute('DELETE FROM weapon_records WHERE uid = $1', [uid]);
}

// ============== 数据迁移（从 localStorage 到 SQLite） ==============
// 注意：以下迁移函数已废弃，请使用 lib/storage/migration.ts 中的统一迁移逻辑

/**
 * @deprecated 使用 lib/storage/migration.ts 中的 needsMigration() 代替
 * 检查是否需要迁移数据
 */
export async function checkAndMigrateData(): Promise<boolean> {
  const database = await getDB();
  
  // 检查数据库是否为空
  const accounts = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM accounts'
  );
  
  // 如果数据库已有数据，不需要迁移
  const count = accounts[0]?.count ?? 0;
  if (count > 0) {
    return false;
  }
  
  // 检查 localStorage 是否有数据
  const localAccounts = localStorage.getItem('efgh.accounts');
  if (!localAccounts) {
    return false;
  }
  
  return true;
}

/**
 * @deprecated 使用 lib/storage/migration.ts 中的 migrateFromLocalStorage() 代替
 * 从 localStorage 迁移数据到 SQLite
 */
export async function migrateFromLocalStorage(): Promise<{
  accounts: number;
  charRecords: number;
  weaponRecords: number;
}> {
  const result = { accounts: 0, charRecords: 0, weaponRecords: 0 };

  const asRecord = (v: unknown): Record<string, unknown> | null => {
    if (!v || typeof v !== 'object') return null;
    return v as Record<string, unknown>;
  };
  const parseJsonUnknown = (json: string): unknown => {
    try {
      return JSON.parse(json) as unknown;
    } catch {
      return null;
    }
  };
  
  // 迁移账号
  const localAccounts = localStorage.getItem('efgh.accounts');
  if (localAccounts) {
    try {
      const parsed = parseJsonUnknown(localAccounts);
      const accounts = Array.isArray(parsed) ? parsed : [];
      for (const raw of accounts) {
        const acc = asRecord(raw);
        if (!acc) continue;
        const uid = typeof acc.uid === 'string' ? acc.uid : null;
        const channelName = typeof acc.channelName === 'string' ? acc.channelName : null;
        const addedAt = typeof acc.addedAt === 'number' ? acc.addedAt : null;
        if (!uid || !channelName || addedAt === null) continue;

        const uidIsLegacyHgUid = typeof uid === 'string' && uid.length > 0 && !uid.includes(':');
        const hgUid =
          (typeof acc.hgUid === 'string' && acc.hgUid.trim().length > 0 ? acc.hgUid : null) ??
          (uidIsLegacyHgUid ? uid : null);

        await dbSaveAccount({
          uid,
          hg_uid: hgUid,
          channel_name: channelName,
          roles: JSON.stringify(acc.roles ?? []),
          added_at: addedAt,
        });
        result.accounts++;
      }
    } catch (e) {
      console.error('迁移账号失败:', e);
    }
  }
  
  // 迁移角色记录
  const localGachaRecords = localStorage.getItem('efgh.gachaRecords');
  if (localGachaRecords) {
    try {
      const parsed = parseJsonUnknown(localGachaRecords);
      const records = Array.isArray(parsed) ? parsed : [];
      const dbRecords: DBGachaRecord[] = [];

      for (const raw of records) {
        const r = asRecord(raw);
        if (!r) continue;
        const record_uid = typeof r.recordUid === 'string' ? r.recordUid : null;
        const uid = typeof r.uid === 'string' ? r.uid : null;
        const pool_id = typeof r.poolId === 'string' ? r.poolId : null;
        const pool_name = typeof r.poolName === 'string' ? r.poolName : null;
        const char_id = typeof r.charId === 'string' ? r.charId : null;
        const char_name = typeof r.charName === 'string' ? r.charName : null;
        const rarity = typeof r.rarity === 'number' ? r.rarity : null;
        const gacha_ts = typeof r.gachaTs === 'string' ? r.gachaTs : null;
        const seq_id = typeof r.seqId === 'string' ? r.seqId : null;
        const fetched_at = typeof r.fetchedAt === 'number' ? r.fetchedAt : null;
        if (
          !record_uid ||
          !uid ||
          !pool_id ||
          !pool_name ||
          !char_id ||
          !char_name ||
          rarity === null ||
          !gacha_ts ||
          !seq_id ||
          fetched_at === null
        ) {
          continue;
        }

        dbRecords.push({
          record_uid,
          uid,
          pool_id,
          pool_name,
          char_id,
          char_name,
          rarity,
          is_new: r.isNew ? 1 : 0,
          is_free: r.isFree ? 1 : 0,
          gacha_ts,
          seq_id,
          fetched_at,
          category: 'character',
        });
      }
      result.charRecords = await dbSaveGachaRecords(dbRecords);
    } catch (e) {
      console.error('迁移角色记录失败:', e);
    }
  }
  
  // 迁移武器记录
  const localWeaponRecords = localStorage.getItem('efgh.weaponRecords');
  if (localWeaponRecords) {
    try {
      const parsed = parseJsonUnknown(localWeaponRecords);
      const records = Array.isArray(parsed) ? parsed : [];
      const dbRecords: DBWeaponRecord[] = [];

      for (const raw of records) {
        const r = asRecord(raw);
        if (!r) continue;
        const record_uid = typeof r.recordUid === 'string' ? r.recordUid : null;
        const uid = typeof r.uid === 'string' ? r.uid : null;
        const pool_id = typeof r.poolId === 'string' ? r.poolId : null;
        const pool_name = typeof r.poolName === 'string' ? r.poolName : null;
        const weapon_id = typeof r.weaponId === 'string' ? r.weaponId : null;
        const weapon_name = typeof r.weaponName === 'string' ? r.weaponName : null;
        const weapon_type = typeof r.weaponType === 'string' ? r.weaponType : null;
        const rarity = typeof r.rarity === 'number' ? r.rarity : null;
        const gacha_ts = typeof r.gachaTs === 'string' ? r.gachaTs : null;
        const seq_id = typeof r.seqId === 'string' ? r.seqId : null;
        const fetched_at = typeof r.fetchedAt === 'number' ? r.fetchedAt : null;
        if (
          !record_uid ||
          !uid ||
          !pool_id ||
          !pool_name ||
          !weapon_id ||
          !weapon_name ||
          !weapon_type ||
          rarity === null ||
          !gacha_ts ||
          !seq_id ||
          fetched_at === null
        ) {
          continue;
        }

        dbRecords.push({
          record_uid,
          uid,
          pool_id,
          pool_name,
          weapon_id,
          weapon_name,
          weapon_type,
          rarity,
          is_new: r.isNew ? 1 : 0,
          gacha_ts,
          seq_id,
          fetched_at,
          category: 'weapon',
        });
      }
      result.weaponRecords = await dbSaveWeaponRecords(dbRecords);
    } catch (e) {
      console.error('迁移武器记录失败:', e);
    }
  }
  
  // 注意：
  // 当前应用的读写仍主要依赖 localStorage（见 storage.ts 中的 getAccounts/getGachaRecords 等），
  // 如果在迁移完成后清除 localStorage，会导致 UI 侧“数据消失”。
  // 因此这里暂不清除 localStorage，避免丢数据/白屏。
  // 后续如果完全切换到 SQLite 作为读写源，再考虑清理逻辑或迁移标记。
  
  return result;
}
