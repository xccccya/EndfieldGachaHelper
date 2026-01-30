/**
 * 抽卡记录页面
 * 支持角色和武器记录的统一显示
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  History,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight,
  CalendarDays,
  Search,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, RarityBadge, Input, CharacterAvatar, WeaponAvatar } from '../components';
import { useAccounts, useGachaRecordsData } from '../../hooks/useEndfield';
import { charRecordToUnified, weaponRecordToUnified, type UnifiedGachaRecord } from '../../lib/storage';
import { formatDate, getTimestamp } from '../../lib/dateUtils';

/** 卡池类型筛选 */
type PoolFilter = 'all' | 'special' | 'weapon' | 'standard' | 'beginner';

/** 日期筛选 */
type DateFilter = 'all' | 'yesterday' | 'today' | 'last7days' | 'thisMonth';

/**
 * 卡池筛选配置
 * - 限定池：角色池，poolId 不是 standard 或 beginner
 * - 武器池：所有武器记录
 * - 常驻池：角色池，poolId === "standard"
 * - 新手池：角色池，poolId === "beginner"
 */
const POOL_FILTERS: { value: PoolFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'records.allPools' },
  { value: 'special', labelKey: 'records.specialPool' },
  { value: 'weapon', labelKey: 'records.weaponPool' },
  { value: 'standard', labelKey: 'records.standardPool' },
  { value: 'beginner', labelKey: 'records.beginnerPool' },
];

const RARITY_FILTERS = [
  { value: 0, labelKey: 'records.allRarity' },
  { value: 6, labelKey: 'records.rarity6' },
  { value: 5, labelKey: 'records.rarity5' },
  { value: 4, labelKey: 'records.rarity4' },
];

const DATE_FILTERS: { value: DateFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'records.dateAll' },
  { value: 'yesterday', labelKey: 'records.dateYesterday' },
  { value: 'today', labelKey: 'records.dateToday' },
  { value: 'last7days', labelKey: 'records.dateLast7Days' },
  { value: 'thisMonth', labelKey: 'records.dateThisMonth' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100] as const;
const DEFAULT_PAGE_SIZE: (typeof PAGE_SIZE_OPTIONS)[number] = 10;

function getDateRange(filter: DateFilter): { startMs: number; endMs: number } | null {
  if (filter === 'all') return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (filter) {
    case 'today':
      return { startMs: todayStart, endMs: todayStart + dayMs };
    case 'yesterday':
      return { startMs: todayStart - dayMs, endMs: todayStart };
    case 'last7days': {
      // 近七日（含今日）：从 6 天前 00:00 到明日 00:00
      return { startMs: todayStart - dayMs * 6, endMs: todayStart + dayMs };
    }
    case 'thisMonth': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return { startMs: monthStart, endMs: nextMonthStart };
    }
    default:
      return null;
  }
}

/**
 * 根据卡池筛选类型过滤记录
 */
function filterByPoolType(records: UnifiedGachaRecord[], poolFilter: PoolFilter): UnifiedGachaRecord[] {
  switch (poolFilter) {
    case 'all':
      return records;
    case 'special':
      // 限定池：角色池，poolId 不是 standard 或 beginner
      return records.filter(r => 
        r.category === 'character' && 
        r.poolId !== 'standard' && 
        r.poolId !== 'beginner'
      );
    case 'weapon':
      // 武器池：所有武器记录
      return records.filter(r => r.category === 'weapon');
    case 'standard':
      // 常驻池：角色池，poolId === "standard"
      return records.filter(r => 
        r.category === 'character' && 
        r.poolId === 'standard'
      );
    case 'beginner':
      // 新手池：角色池，poolId === "beginner"
      return records.filter(r => 
        r.category === 'character' && 
        r.poolId === 'beginner'
      );
    default:
      return records;
  }
}

export function RecordsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeUid, activeAccount, loading: accountsLoading } = useAccounts();
  const { gachaRecords, weaponRecords, loading: recordsLoading } = useGachaRecordsData(activeUid);
  
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [rarityFilter, setRarityFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE);
  const [jumpInput, setJumpInput] = useState('');

  // 将记录转换为统一格式并排序
  const allRecords = useMemo(() => {
    const charUnified = gachaRecords.map(charRecordToUnified);
    const weaponUnified = weaponRecords.map(weaponRecordToUnified);
    const all = [...charUnified, ...weaponUnified];
    
    // 按时间和 seqId 排序（最新的在前）
    all.sort((a, b) => {
      const timeA = getTimestamp(a.gachaTs);
      const timeB = getTimestamp(b.gachaTs);
      if (timeA !== timeB) return timeB - timeA;
      
      const seqA = Number(a.seqId);
      const seqB = Number(b.seqId);
      if (Number.isFinite(seqA) && Number.isFinite(seqB)) {
        return seqB - seqA;
      }
      return 0;
    });
    
    return all;
  }, [gachaRecords, weaponRecords]);

  const filteredRecords = useMemo(() => {
    let records = allRecords;

    // 卡池类型筛选
    records = filterByPoolType(records, poolFilter);

    // 日期筛选
    const range = getDateRange(dateFilter);
    if (range) {
      records = records.filter((r) => {
        const ts = getTimestamp(r.gachaTs);
        return ts >= range.startMs && ts < range.endMs;
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
  }, [allRecords, poolFilter, dateFilter, rarityFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const commitJump = () => {
    const raw = jumpInput.trim();
    if (!raw) return;
    const num = Number.parseInt(raw, 10);
    if (Number.isNaN(num)) return;
    const next = Math.max(1, Math.min(totalPages, num));
    setPage(next);
    setJumpInput('');
  };

  // 加载状态
  if (accountsLoading || recordsLoading) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <Loader2 size={48} className="mx-auto mb-4 text-brand animate-spin" />
            <h3 className="text-lg font-semibold mb-2">{t('common.loading')}</h3>
          </div>
        </CardContent>
      </Card>
    );
  }

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

            {/* 卡池类型筛选 */}
            <div className="relative">
              <select
                value={poolFilter}
                onChange={(e) => {
                  setPoolFilter(e.target.value as PoolFilter);
                  setPage(1);
                }}
                className="appearance-none bg-bg-2 border border-border rounded-md px-4 py-2.5 pr-10 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {POOL_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {t(f.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none" />
            </div>

            {/* 日期筛选 */}
            <div className="relative">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as DateFilter);
                  setPage(1);
                }}
                className="appearance-none bg-bg-2 border border-border rounded-md pl-9 pr-10 px-4 py-2.5 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {DATE_FILTERS.map((f) => (
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
                className="appearance-none bg-bg-2 border border-border rounded-md px-4 py-2.5 pr-10 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-t border-border bg-bg-2/30">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {/* 每页条数 */}
                  <div className="flex items-center gap-2 text-sm text-fg-2">
                    <span>{t('records.pageSize')}</span>
                    <div className="relative">
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          const nextSize = Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number];
                          const firstItemIndex = (page - 1) * pageSize;
                          const nextPage = Math.floor(firstItemIndex / nextSize) + 1;
                          const nextTotalPages = Math.max(1, Math.ceil(filteredRecords.length / nextSize));
                          setPageSize(nextSize);
                          setPage(Math.max(1, Math.min(nextTotalPages, nextPage)));
                        }}
                        className="appearance-none bg-bg-2 border border-border rounded-md px-3 py-1.5 pr-8 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
                      >
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none" />
                    </div>
                    <span>{t('records.perPage')}</span>
                  </div>

                  {/* 总数/页码 */}
                  <div className="text-sm text-fg-2">
                    {totalPages > 1 ? (
                      <>
                        {t('records.page', { current: page, total: totalPages })}
                        <span className="ml-2">· {t('records.total', { count: filteredRecords.length })}</span>
                      </>
                    ) : (
                      <>{t('records.total', { count: filteredRecords.length })}</>
                    )}
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {/* 首页/上一页/下一页/末页 */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(1)}
                        aria-label={t('records.first')}
                        title={t('records.first')}
                        icon={<ChevronsLeft size={16} />}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        aria-label={t('records.prev')}
                        title={t('records.prev')}
                        icon={<ChevronLeft size={16} />}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        aria-label={t('records.next')}
                        title={t('records.next')}
                        icon={<ChevronRight size={16} />}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(totalPages)}
                        aria-label={t('records.last')}
                        title={t('records.last')}
                        icon={<ChevronsRight size={16} />}
                      />
                    </div>

                    {/* 页码跳转 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-fg-2">{t('records.jump')}</span>
                      <div className="w-20">
                        <Input
                          value={jumpInput}
                          onChange={(e) => setJumpInput(e.target.value)}
                          onBlur={() => commitJump()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitJump();
                            }
                          }}
                          placeholder={t('records.pageNumber')}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="px-3 py-1.5"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!jumpInput.trim()}
                        onClick={() => commitJump()}
                        icon={<ArrowRight size={16} />}
                        aria-label={t('records.go')}
                        title={t('records.go')}
                        className="px-2.5"
                      >
                        <span className="hidden sm:inline">{t('records.go')}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecordRow({ record }: { record: UnifiedGachaRecord }) {
  const { t } = useTranslation();
  const rarityColors: Record<number, string> = {
    6: 'text-orange-500',
    5: 'text-amber-400',
    4: 'text-purple-500',
    3: 'text-blue-400',
  };

  const isWeapon = record.category === 'weapon';

  return (
    <div className="grid grid-cols-12 gap-2 px-5 py-3 hover:bg-bg-2/50 transition-colors items-center">
      <div className="col-span-4 flex items-center gap-2 min-w-0">
        <div className="shrink-0">
          {isWeapon ? (
            <WeaponAvatar weaponId={record.weaponId} rarity={record.rarity} size="sm" isEmpty={!record.weaponId} />
          ) : (
            <CharacterAvatar charId={record.charId} rarity={record.rarity} size="sm" isEmpty={!record.charId} />
          )}
        </div>
        <span className={`font-medium truncate ${rarityColors[record.rarity] || 'text-fg-1'}`}>
          {record.itemName}
        </span>
        {record.isNew && (
          <Badge variant="success" className="text-xs">{t('common.new')}</Badge>
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
