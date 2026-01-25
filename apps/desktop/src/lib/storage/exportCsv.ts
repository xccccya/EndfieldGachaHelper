/**
 * CSV 导出/导入
 */

import { getTimestamp } from '../dateUtils';
import type { GachaRecord, WeaponRecord } from './types';
import { getGachaRecords, saveGachaRecords } from './gachaRecords';
import { getWeaponRecords, saveWeaponRecords } from './weaponRecords';
import { notifyStorageChange } from './events';

/** CSV 导出文件头（与软件数据结构对应） */
const CSV_HEADERS = {
  character: [
    'recordUid',    // 记录唯一ID
    'uid',          // 游戏账号UID
    'category',     // 记录类型：character
    'poolId',       // 卡池ID
    'poolName',     // 卡池名称
    'charId',       // 角色ID
    'charName',     // 角色名称
    'rarity',       // 稀有度
    'isNew',        // 是否首次获得
    'isFree',       // 是否为免费
    'gachaTs',      // 抽卡时间
    'seqId',        // 序列ID
    'fetchedAt',    // 记录获取时间
  ],
  weapon: [
    'recordUid',
    'uid',
    'category',     // 记录类型：weapon
    'poolId',
    'poolName',
    'weaponId',     // 武器ID
    'weaponName',   // 武器名称
    'weaponType',   // 武器类型
    'rarity',
    'isNew',
    'gachaTs',
    'seqId',
    'fetchedAt',
  ],
  unified: [
    'recordUid',
    'uid',
    'category',
    'poolId',
    'poolName',
    'itemId',       // 物品ID（角色ID或武器ID）
    'itemName',     // 物品名称
    'itemType',     // 物品类型（角色为空，武器为武器类型）
    'rarity',
    'isNew',
    'isFree',       // 仅角色有此字段
    'gachaTs',
    'seqId',
    'fetchedAt',
  ],
};

/**
 * 转义 CSV 字段值
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = (() => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'symbol') return value.description ?? value.toString();
    return '';
  })();
  // 如果包含逗号、双引号或换行符，需要用双引号包裹
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 解析 CSV 字段值
 */
function parseCSVField(field: string): string {
  field = field.trim();
  // 移除首尾的双引号并处理转义
  if (field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

/**
 * 解析 CSV 行（处理引号内的逗号）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // 跳过下一个引号
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result.map(parseCSVField);
}

/**
 * 导出角色抽卡记录为 CSV
 */
export async function exportGachaRecordsToCSV(uid?: string): Promise<string> {
  const records = await getGachaRecords(uid);
  const headers = CSV_HEADERS.character;

  const rows = [headers.join(',')];

  for (const record of records) {
    const row = [
      escapeCSVField(record.recordUid),
      escapeCSVField(record.uid),
      escapeCSVField('character'),
      escapeCSVField(record.poolId),
      escapeCSVField(record.poolName),
      escapeCSVField(record.charId),
      escapeCSVField(record.charName),
      escapeCSVField(record.rarity),
      escapeCSVField(record.isNew ? 1 : 0),
      escapeCSVField(record.isFree ? 1 : 0),
      escapeCSVField(record.gachaTs),
      escapeCSVField(record.seqId),
      escapeCSVField(record.fetchedAt),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * 导出武器抽卡记录为 CSV
 */
export async function exportWeaponRecordsToCSV(uid?: string): Promise<string> {
  const records = await getWeaponRecords(uid);
  const headers = CSV_HEADERS.weapon;

  const rows = [headers.join(',')];

  for (const record of records) {
    const row = [
      escapeCSVField(record.recordUid),
      escapeCSVField(record.uid),
      escapeCSVField('weapon'),
      escapeCSVField(record.poolId),
      escapeCSVField(record.poolName),
      escapeCSVField(record.weaponId),
      escapeCSVField(record.weaponName),
      escapeCSVField(record.weaponType),
      escapeCSVField(record.rarity),
      escapeCSVField(record.isNew ? 1 : 0),
      escapeCSVField(record.gachaTs),
      escapeCSVField(record.seqId),
      escapeCSVField(record.fetchedAt),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * 导出所有抽卡记录为统一格式 CSV
 */
export async function exportAllRecordsToCSV(uid?: string): Promise<string> {
  const [charRecords, weaponRecords] = await Promise.all([
    getGachaRecords(uid),
    getWeaponRecords(uid),
  ]);
  const headers = CSV_HEADERS.unified;

  const rows = [headers.join(',')];

  // 合并并按时间排序
  type MergedRecord = {
    recordUid: string;
    uid: string;
    category: string;
    poolId: string;
    poolName: string;
    itemId: string;
    itemName: string;
    itemType: string;
    rarity: number;
    isNew: boolean;
    isFree: boolean;
    gachaTs: string;
    seqId: string;
    fetchedAt: number;
  };

  const allRecords: MergedRecord[] = [
    ...charRecords.map(r => ({
      recordUid: r.recordUid,
      uid: r.uid,
      category: 'character',
      poolId: r.poolId,
      poolName: r.poolName,
      itemId: r.charId,
      itemName: r.charName,
      itemType: '',
      rarity: r.rarity,
      isNew: r.isNew,
      isFree: r.isFree,
      gachaTs: r.gachaTs,
      seqId: r.seqId,
      fetchedAt: r.fetchedAt,
    })),
    ...weaponRecords.map(r => ({
      recordUid: r.recordUid,
      uid: r.uid,
      category: 'weapon',
      poolId: r.poolId,
      poolName: r.poolName,
      itemId: r.weaponId,
      itemName: r.weaponName,
      itemType: r.weaponType,
      rarity: r.rarity,
      isNew: r.isNew,
      isFree: false,
      gachaTs: r.gachaTs,
      seqId: r.seqId,
      fetchedAt: r.fetchedAt,
    })),
  ];

  // 按时间排序（最新的在前）
  allRecords.sort((a, b) => getTimestamp(b.gachaTs) - getTimestamp(a.gachaTs));

  for (const record of allRecords) {
    const row = [
      escapeCSVField(record.recordUid),
      escapeCSVField(record.uid),
      escapeCSVField(record.category),
      escapeCSVField(record.poolId),
      escapeCSVField(record.poolName),
      escapeCSVField(record.itemId),
      escapeCSVField(record.itemName),
      escapeCSVField(record.itemType),
      escapeCSVField(record.rarity),
      escapeCSVField(record.isNew ? 1 : 0),
      escapeCSVField(record.isFree ? 1 : 0),
      escapeCSVField(record.gachaTs),
      escapeCSVField(record.seqId),
      escapeCSVField(record.fetchedAt),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * 从 CSV 导入抽卡记录
 * 支持角色、武器或统一格式的 CSV
 */
export async function importRecordsFromCSV(csvContent: string): Promise<{
  charRecords: number;
  weaponRecords: number;
  errors: string[];
}> {
  const result = { charRecords: 0, weaponRecords: 0, errors: [] as string[] };

  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    result.errors.push('CSV 文件为空或格式错误');
    return result;
  }

  const headerLine = lines[0];
  if (!headerLine) {
    result.errors.push('CSV 文件头为空');
    return result;
  }

  const headers = parseCSVLine(headerLine);
  const headerSet = new Set(headers);

  // 判断 CSV 类型
  const isCharCSV = headerSet.has('charId') && headerSet.has('charName');
  const isWeaponCSV = headerSet.has('weaponId') && headerSet.has('weaponName');
  const isUnifiedCSV = headerSet.has('itemId') && headerSet.has('itemName') && headerSet.has('category');

  if (!isCharCSV && !isWeaponCSV && !isUnifiedCSV) {
    result.errors.push('无法识别的 CSV 格式，请使用本软件导出的 CSV 文件');
    return result;
  }

  // 创建字段索引映射
  const fieldIndex: Record<string, number> = {};
  headers.forEach((h, i) => { fieldIndex[h] = i; });

  const newCharRecords: GachaRecord[] = [];
  const newWeaponRecords: WeaponRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      if (!line) continue;

      const fields = parseCSVLine(line);
      if (fields.length < headers.length) continue;

      const getValue = (key: string): string => {
        const idx = fieldIndex[key];
        return idx !== undefined ? (fields[idx] ?? '') : '';
      };
      const getNumber = (key: string): number => parseInt(getValue(key), 10) || 0;
      const getBool = (key: string): boolean => getValue(key) === '1' || getValue(key).toLowerCase() === 'true';

      if (isUnifiedCSV) {
        // 统一格式
        const category = getValue('category');
        if (category === 'character') {
          newCharRecords.push({
            recordUid: getValue('recordUid'),
            uid: getValue('uid'),
            poolId: getValue('poolId'),
            poolName: getValue('poolName'),
            charId: getValue('itemId'),
            charName: getValue('itemName'),
            rarity: getNumber('rarity'),
            isNew: getBool('isNew'),
            isFree: getBool('isFree'),
            gachaTs: getValue('gachaTs'),
            seqId: getValue('seqId'),
            fetchedAt: getNumber('fetchedAt'),
            category: 'character',
          });
        } else if (category === 'weapon') {
          newWeaponRecords.push({
            recordUid: getValue('recordUid'),
            uid: getValue('uid'),
            poolId: getValue('poolId'),
            poolName: getValue('poolName'),
            weaponId: getValue('itemId'),
            weaponName: getValue('itemName'),
            weaponType: getValue('itemType'),
            rarity: getNumber('rarity'),
            isNew: getBool('isNew'),
            gachaTs: getValue('gachaTs'),
            seqId: getValue('seqId'),
            fetchedAt: getNumber('fetchedAt'),
            category: 'weapon',
          });
        }
      } else if (isCharCSV) {
        // 角色格式
        newCharRecords.push({
          recordUid: getValue('recordUid'),
          uid: getValue('uid'),
          poolId: getValue('poolId'),
          poolName: getValue('poolName'),
          charId: getValue('charId'),
          charName: getValue('charName'),
          rarity: getNumber('rarity'),
          isNew: getBool('isNew'),
          isFree: getBool('isFree'),
          gachaTs: getValue('gachaTs'),
          seqId: getValue('seqId'),
          fetchedAt: getNumber('fetchedAt'),
          category: 'character',
        });
      } else if (isWeaponCSV) {
        // 武器格式
        newWeaponRecords.push({
          recordUid: getValue('recordUid'),
          uid: getValue('uid'),
          poolId: getValue('poolId'),
          poolName: getValue('poolName'),
          weaponId: getValue('weaponId'),
          weaponName: getValue('weaponName'),
          weaponType: getValue('weaponType'),
          rarity: getNumber('rarity'),
          isNew: getBool('isNew'),
          gachaTs: getValue('gachaTs'),
          seqId: getValue('seqId'),
          fetchedAt: getNumber('fetchedAt'),
          category: 'weapon',
        });
      }
    } catch {
      result.errors.push(`第 ${i + 1} 行解析失败`);
    }
  }

  // 合并角色记录
  if (newCharRecords.length > 0) {
    const existing = await getGachaRecords();
    const existingIds = new Set(existing.map(r => r.recordUid));

    for (const record of newCharRecords) {
      if (!existingIds.has(record.recordUid)) {
        existing.push(record);
        existingIds.add(record.recordUid);
        result.charRecords++;
      }
    }

    if (result.charRecords > 0) {
      existing.sort((a, b) => getTimestamp(b.gachaTs) - getTimestamp(a.gachaTs));
      await saveGachaRecords(existing);
    }
  }

  // 合并武器记录
  if (newWeaponRecords.length > 0) {
    const existing = await getWeaponRecords();
    const existingIds = new Set(existing.map(r => r.recordUid));

    for (const record of newWeaponRecords) {
      if (!existingIds.has(record.recordUid)) {
        existing.push(record);
        existingIds.add(record.recordUid);
        result.weaponRecords++;
      }
    }

    if (result.weaponRecords > 0) {
      existing.sort((a, b) => getTimestamp(b.gachaTs) - getTimestamp(a.gachaTs));
      await saveWeaponRecords(existing);
    }
  }

  notifyStorageChange({ reason: 'importCSV', keys: ['gachaRecords', 'weaponRecords'] });

  return result;
}
