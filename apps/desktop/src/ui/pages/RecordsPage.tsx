/**
 * 抽卡记录页面
 * 支持角色和武器记录的统一显示
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  History,
  ChevronDown,
  Search,
  AlertCircle,
  User,
  Sword,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, RarityBadge, Input } from '../components';
import { useAccounts } from '../../hooks/useEndfield';
import { getAllUnifiedRecords, type UnifiedGachaRecord } from '../../lib/storage';
import { formatDate } from '../../lib/dateUtils';
import type { GachaCategory } from '@efgachahelper/shared';

/**
 * 类别筛选配置
 */
const CATEGORY_FILTERS: { value: GachaCategory | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'records.allCategories' },
  { value: 'character', labelKey: 'records.characterCategory' },
  { value: 'weapon', labelKey: 'records.weaponCategory' },
];

/**
 * 卡池筛选配置
 * 角色池: special_1_0_1, standard_1_0_1, beginner_1_0_1
 * 武器池: weponbox_1_0_1, weaponbox_constant_2
 */
const POOL_FILTERS = [
  { value: 'all', labelKey: 'records.allPools' },
  // 角色池
  { value: 'special', labelKey: 'records.specialPool' },
  { value: 'standard', labelKey: 'records.standardPool' },
  { value: 'beginner', labelKey: 'records.beginnerPool' },
  // 武器池
  { value: 'weponbox', labelKey: 'records.weaponSpecialPool' },
  { value: 'weaponbox', labelKey: 'records.weaponStandardPool' },
];

const RARITY_FILTERS = [
  { value: 0, labelKey: 'records.allRarity' },
  { value: 6, labelKey: 'records.rarity6' },
  { value: 5, labelKey: 'records.rarity5' },
  { value: 4, labelKey: 'records.rarity4' },
];

const PAGE_SIZE = 20;

export function RecordsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeUid, activeAccount } = useAccounts();
  
  const [categoryFilter, setCategoryFilter] = useState<GachaCategory | 'all'>('all');
  const [poolFilter, setPoolFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const allRecords = useMemo(() => {
    if (!activeUid) return [];
    return getAllUnifiedRecords(activeUid);
  }, [activeUid]);

  const filteredRecords = useMemo(() => {
    let records = allRecords;

    // 类别筛选（角色/武器）
    if (categoryFilter !== 'all') {
      records = records.filter((r) => r.category === categoryFilter);
    }

    // 卡池筛选 - 根据 poolId 前缀匹配
    if (poolFilter !== 'all') {
      records = records.filter((r) => {
        const poolPrefix = r.poolId?.toLowerCase().split('_')[0];
        return poolPrefix === poolFilter;
      });
    }

    // 稀有度筛选
    if (rarityFilter > 0) {
      records = records.filter((r) => r.rarity === rarityFilter);
    }

    // 搜索 - 使用统一的 itemName 字段
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      records = records.filter((r) => 
        r.itemName.toLowerCase().includes(query) ||
        r.poolName.toLowerCase().includes(query)
      );
    }

    return records;
  }, [allRecords, categoryFilter, poolFilter, rarityFilter, searchQuery]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, page]);

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);

  if (!activeAccount) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto mb-4 text-fg-2/50" />
            <h3 className="text-lg font-semibold mb-2">{t('records.noAccount')}</h3>
            <p className="text-fg-2 mb-4">{t('records.noAccountHint')}</p>
            <Button variant="accent" onClick={() => { void navigate('/account'); }}>
              {t('records.goAddAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 搜索框 */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('records.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                icon={<Search size={18} />}
              />
            </div>

            {/* 类别筛选（角色/武器） */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as GachaCategory | 'all');
                  setPoolFilter('all'); // 重置卡池筛选
                  setPage(1);
                }}
                className="appearance-none bg-bg-2 border border-border rounded-lg px-4 py-2.5 pr-10 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {CATEGORY_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {t(f.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none" />
            </div>

            {/* 卡池筛选 */}
            <div className="relative">
              <select
                value={poolFilter}
                onChange={(e) => {
                  setPoolFilter(e.target.value);
                  setPage(1);
                }}
                className="appearance-none bg-bg-2 border border-border rounded-lg px-4 py-2.5 pr-10 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {POOL_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {t(f.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none" />
            </div>

            {/* 稀有度筛选 */}
            <div className="relative">
              <select
                value={rarityFilter}
                onChange={(e) => {
                  setRarityFilter(Number(e.target.value));
                  setPage(1);
                }}
                className="appearance-none bg-bg-2 border border-border rounded-lg px-4 py-2.5 pr-10 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {RARITY_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {t(f.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none" />
            </div>

            {/* 统计 */}
            <Badge variant="default" className="py-2">
              {t('records.total', { count: filteredRecords.length })}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 记录列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <History size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('records.title')}</h2>
                <p className="text-sm text-fg-1">
                  {activeAccount.roles[0]?.nickName} · {activeAccount.channelName}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <History size={48} className="mx-auto mb-4 text-fg-2/30" />
              <h3 className="text-lg font-semibold mb-2">{t('records.empty')}</h3>
              <p className="text-fg-2 mb-4">{t('records.emptyHint')}</p>
              <Button variant="accent" onClick={() => { void navigate('/sync'); }}>
                {t('records.goSync')}
              </Button>
            </div>
          ) : (
            <>
              {/* 表格头部 */}
              <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-bg-2 text-sm font-medium text-fg-1 border-b border-border">
                <div className="col-span-4">{t('records.colName')}</div>
                <div className="col-span-2 text-center">{t('records.colRarity')}</div>
                <div className="col-span-3">{t('records.colPool')}</div>
                <div className="col-span-3 text-right">{t('records.colTime')}</div>
              </div>

              {/* 记录列表 */}
              <div className="divide-y divide-border">
                {paginatedRecords.map((record) => (
                  <RecordRow key={record.recordUid} record={record} />
                ))}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border">
                  <div className="text-sm text-fg-2">
                    {t('records.page', { current: page, total: totalPages })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      {t('records.prev')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t('records.next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecordRow({ record }: { record: UnifiedGachaRecord }) {
  const rarityColors: Record<number, string> = {
    6: 'text-orange-400',
    5: 'text-yellow-400',
    4: 'text-purple-400',
    3: 'text-blue-400',
  };

  const isWeapon = record.category === 'weapon';

  return (
    <div className="grid grid-cols-12 gap-2 px-5 py-3 hover:bg-bg-2/50 transition-colors items-center">
      <div className="col-span-4 flex items-center gap-2">
        {/* 类别图标 */}
        {isWeapon ? (
          <Sword size={14} className="text-fg-2/50 flex-shrink-0" />
        ) : (
          <User size={14} className="text-fg-2/50 flex-shrink-0" />
        )}
        <span className={`font-medium ${rarityColors[record.rarity] || 'text-fg-1'}`}>
          {record.itemName}
        </span>
        {record.isNew && (
          <Badge variant="success" className="text-xs">NEW</Badge>
        )}
      </div>
      <div className="col-span-2 text-center">
        <RarityBadge rarity={record.rarity} />
      </div>
      <div className="col-span-3 text-sm text-fg-1 truncate">
        {record.poolName}
      </div>
      <div className="col-span-3 text-sm text-fg-1 text-right">
        {formatDate(record.gachaTs)}
      </div>
    </div>
  );
}

export default RecordsPage;
