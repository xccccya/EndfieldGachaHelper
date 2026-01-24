/**
 * 统计页面
 * 支持角色和武器统计
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Star,
  Hash,
  AlertCircle,
  Sparkles,
  User,
  Sword,
  ChevronDown,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, RarityBadge } from '../components';
import { useAccounts } from '../../hooks/useEndfield';
import { getAllUnifiedRecords, calculateUnifiedStats } from '../../lib/storage';
import { formatDateShort } from '../../lib/dateUtils';
import type { GachaCategory } from '@efgachahelper/shared';

/** 卡池类型名称映射 */
const POOL_TYPE_NAMES: Record<string, string> = {
  // 角色池
  'special': '角色限定池',
  'standard': '角色常驻池',
  'beginner': '角色新手池',
  // 武器池
  'weponbox': '武器限定池',
  'weaponbox': '武器常驻池',
};

export function StatsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeUid, activeAccount } = useAccounts();
  
  // 类别筛选
  const [categoryFilter, setCategoryFilter] = useState<GachaCategory | 'all'>('all');

  // 获取统一格式的所有记录
  const allRecords = useMemo(() => {
    if (!activeUid) return [];
    return getAllUnifiedRecords(activeUid);
  }, [activeUid]);

  // 根据类别筛选记录
  const records = useMemo(() => {
    if (categoryFilter === 'all') return allRecords;
    return allRecords.filter((r) => r.category === categoryFilter);
  }, [allRecords, categoryFilter]);

  // 计算统计
  const stats = useMemo(() => calculateUnifiedStats(records), [records]);
  
  // 分类别统计
  const charStats = useMemo(() => 
    calculateUnifiedStats(allRecords, { category: 'character' }), 
  [allRecords]);
  
  const weaponStats = useMemo(() => 
    calculateUnifiedStats(allRecords, { category: 'weapon' }), 
  [allRecords]);

  // 按卡池类型分组统计
  const poolTypeStats = useMemo(() => {
    const types: Record<string, { total: number; rarity6: number; rarity5: number; category: GachaCategory }> = {};
    
    for (const record of records) {
      const poolType = record.poolId?.toLowerCase().split('_')[0] || 'unknown';
      if (!types[poolType]) {
        types[poolType] = { total: 0, rarity6: 0, rarity5: 0, category: record.category };
      }
      types[poolType].total++;
      if (record.rarity === 6) types[poolType].rarity6++;
      if (record.rarity === 5) types[poolType].rarity5++;
    }

    return Object.entries(types)
      .map(([type, data]) => ({ 
        type,
        name: POOL_TYPE_NAMES[type] || type, 
        ...data 
      }))
      .sort((a, b) => b.total - a.total);
  }, [records]);

  // 最近的6星记录
  const recent6Stars = useMemo(() => {
    return records
      .filter((r) => r.rarity === 6)
      .slice(0, 5);
  }, [records]);

  if (!activeAccount) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto mb-4 text-fg-2/50" />
            <h3 className="text-lg font-semibold mb-2">{t('stats.noAccount')}</h3>
            <p className="text-fg-2 mb-4">{t('stats.noAccountHint')}</p>
            <Button variant="accent" onClick={() => { void navigate('/account'); }}>
              {t('stats.goAddAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allRecords.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 size={48} className="mx-auto mb-4 text-fg-2/30" />
            <h3 className="text-lg font-semibold mb-2">{t('stats.noData')}</h3>
            <p className="text-fg-2 mb-4">{t('stats.noDataHint')}</p>
            <Button variant="accent" onClick={() => { void navigate('/sync'); }}>
              {t('stats.goSync')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 计算概率
  const rate6 = stats.total > 0 ? ((stats.byRarity[6] || 0) / stats.total * 100).toFixed(2) : '0';
  const rate5 = stats.total > 0 ? ((stats.byRarity[5] || 0) / stats.total * 100).toFixed(2) : '0';

  return (
    <div className="space-y-4">
      {/* 类别筛选 */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-fg-1">{t('stats.filterBy')}</span>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as GachaCategory | 'all')}
                className="appearance-none bg-bg-2 border border-border rounded-lg px-4 py-2 pr-10 text-sm text-fg-0 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                <option value="all">{t('stats.allCategories')}</option>
                <option value="character">{t('stats.characterCategory')}</option>
                <option value="weapon">{t('stats.weaponCategory')}</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none" />
            </div>
            {/* 分类别统计快速预览 */}
            <div className="flex-1 flex justify-end gap-4 text-sm">
              <span className="flex items-center gap-1 text-blue-400">
                <User size={16} /> {charStats.total} {t('stats.pulls')}
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <Sword size={16} /> {weaponStats.total} {t('stats.pulls')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 概览统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Hash size={24} />}
          iconBg="bg-brand/20"
          iconColor="text-brand"
          value={stats.total}
          label={t('stats.totalPulls')}
        />
        <StatCard
          icon={<Star size={24} />}
          iconBg="bg-orange-500/20"
          iconColor="text-orange-400"
          value={stats.byRarity[6] || 0}
          label={t('stats.total6Star')}
          subValue={`${rate6}%`}
        />
        <StatCard
          icon={<Sparkles size={24} />}
          iconBg="bg-yellow-500/20"
          iconColor="text-yellow-400"
          value={stats.byRarity[5] || 0}
          label={t('stats.total5Star')}
          subValue={`${rate5}%`}
        />
        <StatCard
          icon={<TrendingUp size={24} />}
          iconBg="bg-purple-500/20"
          iconColor="text-purple-400"
          value={stats.pity}
          label={t('stats.currentPity')}
          subValue={t('stats.pityHint')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* 最近6星 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Star size={20} className="text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.recent6Star')}</h2>
                <p className="text-sm text-fg-1">{t('stats.recent6StarDesc')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recent6Stars.length === 0 ? (
              <div className="text-center py-8 text-fg-2">
                <Star size={32} className="mx-auto mb-2 opacity-30" />
                <p>{t('stats.no6Star')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recent6Stars.map((record) => (
                  <div key={record.recordUid} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-sm">
                      {record.category === 'weapon' ? (
                        <Sword size={18} />
                      ) : (
                        record.itemName.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-orange-400 truncate flex items-center gap-1">
                        {record.category === 'weapon' && <Sword size={14} className="text-fg-1/60" />}
                        {record.category === 'character' && <User size={14} className="text-fg-1/60" />}
                        {record.itemName}
                      </div>
                      <div className="text-xs text-fg-1 truncate">
                        {record.poolName}
                      </div>
                    </div>
                    <div className="text-xs text-fg-1 text-right">
                      {formatDateShort(record.gachaTs)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 卡池类型统计 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <BarChart3 size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.poolStats')}</h2>
                <p className="text-sm text-fg-1">{t('stats.poolStatsDesc')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {poolTypeStats.length === 0 ? (
              <div className="text-center py-8 text-fg-2">
                <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                <p>{t('stats.noPoolData')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* 按卡池类型统计 */}
                {poolTypeStats.map((pool) => (
                  <div key={pool.type} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium truncate flex-1 flex items-center gap-1 text-fg-0">
                        {pool.category === 'weapon' ? (
                          <Sword size={14} className="text-orange-400" />
                        ) : (
                          <User size={14} className="text-blue-400" />
                        )}
                        {pool.name}
                      </span>
                      <span className="text-sm text-fg-1 ml-2">{pool.total} {t('stats.pulls')}</span>
                    </div>
                    {/* 进度条 */}
                    <div className="h-2 bg-bg-3 rounded-full overflow-hidden flex">
                      {pool.rarity6 > 0 && (
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${(pool.rarity6 / pool.total) * 100}%` }}
                        />
                      )}
                      {pool.rarity5 > 0 && (
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${(pool.rarity5 / pool.total) * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-fg-1">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        {t('stats.star6Label')}: {pool.rarity6}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        {t('stats.star5Label')}: {pool.rarity5}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 稀有度分布 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-400" />
            </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.rarityDist')}</h2>
                <p className="text-sm text-fg-1">{t('stats.rarityDistDesc')}</p>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/*
              去除三星后，分母也排除三星，避免百分比总和不满 100%
            */}
            {(() => {
              const distTotal = stats.total - (stats.byRarity[3] || 0);
              return [6, 5, 4].map((rarity) => {
                const count = stats.byRarity[rarity] || 0;
                const percentage = distTotal > 0 ? (count / distTotal * 100) : 0;
                const colors: Record<number, { bar: string; text: string }> = {
                  6: { bar: 'bg-orange-500', text: 'text-orange-400' },
                  5: { bar: 'bg-yellow-500', text: 'text-yellow-400' },
                  4: { bar: 'bg-purple-500', text: 'text-purple-400' },
                };

                const colorConfig = colors[rarity] ?? { bar: 'bg-gray-500', text: 'text-gray-400' };

                return (
                  <div key={rarity}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <RarityBadge rarity={rarity} />
                        <span className="text-sm text-fg-1">{count} {t('stats.units')}</span>
                      </div>
                      <span className={`text-sm font-medium ${colorConfig.text}`}>
                        {percentage.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-3 bg-bg-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colorConfig.bar} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  subValue,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: number | string;
  label: string;
  subValue?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-fg-0">{value}</div>
          <div className="text-sm text-fg-1 truncate">{label}</div>
          {subValue && (
            <div className="text-xs text-fg-2 mt-0.5">{subValue}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default StatsPage;
