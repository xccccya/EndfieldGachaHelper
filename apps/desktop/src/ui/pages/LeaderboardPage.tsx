/**
 * 排行榜页面
 * 展示累计抽数、六星数、歪数排行榜
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trophy,
  Star,
  Shuffle,
  Hash,
  RefreshCw,
  Loader2,
  Settings2,
  Eye,
  EyeOff,
  Users,
  AlertCircle,
  Crown,
  Medal,
  Award,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge } from '../components';
import { useSyncConfig } from '../../hooks/useSync';
import { useLeaderboard, useLeaderboardSettings } from '../../hooks/useLeaderboard';
import type { LeaderboardEntry, LeaderboardType } from '@efgachahelper/shared';

const PAGE_SIZE = 10;

// 排行榜类型配置
const LEADERBOARD_TABS: {
  type: LeaderboardType;
  labelKey: string;
  icon: React.ReactNode;
  activeClass: string;
}[] = [
  {
    type: 'total_pulls',
    labelKey: 'leaderboard.totalPulls',
    icon: <Hash size={16} />,
    activeClass: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  },
  {
    type: 'six_star_count',
    labelKey: 'leaderboard.sixStarCount',
    icon: <Star size={16} />,
    activeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  },
  {
    type: 'off_banner_count',
    labelKey: 'leaderboard.offBannerCount',
    icon: <Shuffle size={16} />,
    activeClass: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  },
];

// 排名图标
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-7 h-7 rounded-full bg-yellow-500/15 flex items-center justify-center">
        <Crown size={16} className="text-yellow-500" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-7 h-7 rounded-full bg-gray-400/15 flex items-center justify-center">
        <Medal size={16} className="text-gray-400" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-7 h-7 rounded-full bg-amber-600/15 flex items-center justify-center">
        <Award size={16} className="text-amber-600" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 flex items-center justify-center">
      <span className="text-sm font-mono text-fg-2 font-medium">{rank}</span>
    </div>
  );
}

// 排行榜条目组件
function LeaderboardRow({
  entry,
  isMe,
  valueLabel,
  even,
}: {
  entry: LeaderboardEntry;
  isMe?: boolean;
  valueLabel: string;
  even?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2.5 rounded-md mx-2
        ${isMe
          ? 'bg-brand/10'
          : even
            ? 'bg-bg-2/40'
            : ''
        }
      `}
    >
      {/* 排名 */}
      <div className="w-8 flex items-center justify-center shrink-0">
        <RankBadge rank={entry.rank} />
      </div>

      {/* UID 和区服 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm ${isMe ? 'text-fg-0 font-semibold' : 'text-fg-0'}`}>
            {entry.displayUid}
          </span>
          {entry.uidHidden && (
            <EyeOff size={11} className="text-fg-2/60 shrink-0" />
          )}
          {isMe && (
            <Badge className="bg-brand/20 text-fg-0 text-[10px] px-1.5 py-0 leading-4 border-brand/30">
              {t('leaderboard.meTag', '我')}
            </Badge>
          )}
        </div>
        <div className="text-xs text-fg-2 mt-0.5">{entry.region}</div>
      </div>

      {/* 数值 */}
      <div className="text-right shrink-0">
        <span className="text-base font-bold tabular-nums text-fg-0">
          {entry.value.toLocaleString()}
        </span>
        <span className="text-xs text-fg-2 ml-1">{valueLabel}</span>
      </div>
    </div>
  );
}

// 分页控件
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  // 生成页码按钮列表
  const pages = useMemo(() => {
    const result: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);
      if (currentPage > 3) result.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) result.push(i);
      if (currentPage < totalPages - 2) result.push('ellipsis');
      result.push(totalPages);
    }
    return result;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-center gap-1 py-2.5">
      {/* 上一页 */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-7 h-7 flex items-center justify-center rounded-md text-fg-2 hover:text-fg-0 hover:bg-bg-2 disabled:opacity-25 disabled:cursor-not-allowed"
        aria-label={t('leaderboard.prevPage', '上一页')}
      >
        <ChevronLeft size={15} />
      </button>

      {/* 页码 */}
      {pages.map((page, i) =>
        page === 'ellipsis' ? (
          <span key={`e-${i}`} className="w-7 h-7 flex items-center justify-center text-fg-2 text-xs select-none">
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`
              w-7 h-7 flex items-center justify-center rounded-md text-sm font-medium
              ${currentPage === page
                ? 'bg-brand text-black'
                : 'text-fg-2 hover:text-fg-0 hover:bg-bg-2'
              }
            `}
          >
            {page}
          </button>
        ),
      )}

      {/* 下一页 */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-7 h-7 flex items-center justify-center rounded-md text-fg-2 hover:text-fg-0 hover:bg-bg-2 disabled:opacity-25 disabled:cursor-not-allowed"
        aria-label={t('leaderboard.nextPage', '下一页')}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { isLoggedIn } = useSyncConfig();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('total_pulls');
  const [currentPage, setCurrentPage] = useState(1);

  // 排行榜数据
  const {
    data: leaderboardData,
    loading: leaderboardLoading,
    error: leaderboardError,
    refresh: refreshLeaderboard,
  } = useLeaderboard();

  // 用户设置
  const {
    settings,
    loading: settingsLoading,
    updateSettings,
  } = useLeaderboardSettings();

  // 自动刷新（组件挂载时）
  useEffect(() => {
    void refreshLeaderboard();
  }, [refreshLeaderboard]);

  // 切换 Tab 时重置分页
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // 获取当前 Tab 的排行榜数据
  const currentLeaderboard = leaderboardData?.[
    activeTab === 'total_pulls'
      ? 'totalPulls'
      : activeTab === 'six_star_count'
        ? 'sixStarCount'
        : 'offBannerCount'
  ];

  // 分页计算
  const entries = currentLeaderboard?.entries ?? [];
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pagedEntries = entries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // 获取值标签
  const getValueLabel = (type: LeaderboardType): string => {
    switch (type) {
      case 'total_pulls':
        return t('leaderboard.pullsUnit', '抽');
      case 'six_star_count':
        return t('leaderboard.sixStarsUnit', '个');
      case 'off_banner_count':
        return t('leaderboard.offBannerUnit', '次');
      default:
        return '';
    }
  };

  // 切换参与状态
  const handleToggleParticipate = useCallback(async () => {
    await updateSettings({ participate: !settings?.participate });
  }, [settings?.participate, updateSettings]);

  // 切换隐藏 UID 状态
  const handleToggleHideUid = useCallback(async () => {
    await updateSettings({ hideUid: !settings?.hideUid });
  }, [settings?.hideUid, updateSettings]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return (
    <div className="space-y-4">
      {/* 页面标题栏 */}
      <Card>
        <CardHeader accent noBorder>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-fg-0">{t('leaderboard.title', '排行榜')}</h2>
              <p className="text-sm text-fg-1 truncate">
                {currentLeaderboard?.updatedAt
                  ? t('leaderboard.updatedAt', '更新于 {{time}}', {
                      time: new Date(currentLeaderboard.updatedAt).toLocaleString(),
                    })
                  : t('leaderboard.noData', '暂无数据')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshLeaderboard()}
              disabled={leaderboardLoading}
              icon={<RefreshCw size={16} className={leaderboardLoading ? 'animate-spin' : ''} />}
            >
              {t('common.refresh', '刷新')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tab 切换 */}
      <div className="flex gap-1.5 p-1 bg-bg-1 rounded-lg border border-border">
        {LEADERBOARD_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => setActiveTab(tab.type)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md
              text-sm font-medium border transition-colors
              ${activeTab === tab.type
                ? tab.activeClass
                : 'text-fg-2 border-transparent hover:bg-bg-2 hover:text-fg-1'
              }
            `}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* 我的排名摘要 + 排行榜列表 */}
      <Card>
        <CardContent className="p-0">
          {leaderboardLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-fg-2" />
              <span className="ml-2 text-fg-2 text-sm">{t('common.loading', '加载中...')}</span>
            </div>
          ) : leaderboardError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle size={28} className="text-red-500/70 mb-2" />
              <p className="text-fg-1 text-sm">{t('leaderboard.loadError', '加载失败')}</p>
              <p className="text-xs text-fg-2 mt-1">{leaderboardError}</p>
            </div>
          ) : !currentLeaderboard || entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users size={28} className="text-fg-2/60 mb-2" />
              <p className="text-fg-1 text-sm">{t('leaderboard.noEntries', '暂无排行数据')}</p>
              <p className="text-xs text-fg-2 mt-1">
                {t('leaderboard.beFirst', '成为第一个参与排行的用户吧！')}
              </p>
            </div>
          ) : (
            <>
              {/* 我的排名摘要 */}
              {currentLeaderboard.myRank != null && currentLeaderboard.myValue != null && (
                <div className="mx-2 mt-2 mb-0.5 px-4 py-3 rounded-lg bg-brand/8 flex items-center gap-3">
                  <Trophy size={16} className="text-brand shrink-0" />
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm text-fg-1">{t('leaderboard.myRank', '我的排名')}</span>
                    <span className="text-lg font-bold tabular-nums text-fg-0">
                      #{currentLeaderboard.myRank}
                      <span className="text-fg-2 text-sm font-normal">/{currentLeaderboard.totalCount}</span>
                    </span>
                    <span className="text-fg-2 text-sm">·</span>
                    <span className="text-sm text-fg-0 tabular-nums font-medium">
                      {currentLeaderboard.myValue.toLocaleString()}
                    </span>
                    <span className="text-xs text-fg-2">{getValueLabel(activeTab)}</span>
                  </div>
                </div>
              )}

              {/* 排行榜列表 */}
              <div className="py-1.5">
                {pagedEntries.map((entry, idx) => (
                  <LeaderboardRow
                    key={`${entry.rank}-${entry.displayUid}`}
                    entry={entry}
                    isMe={currentLeaderboard.myRank === entry.rank}
                    valueLabel={getValueLabel(activeTab)}
                    even={idx % 2 === 1}
                  />
                ))}
              </div>

              {/* 分页 */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />

              {/* 参与人数 */}
              <div className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-fg-2 border-t border-border/30">
                <Users size={12} />
                <span>
                  {t('leaderboard.totalParticipants', '共 {{count}} 人参与', {
                    count: currentLeaderboard.totalCount,
                  })}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 用户设置（需要登录） */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fg-2/15 flex items-center justify-center shrink-0">
              <Settings2 size={20} className="text-fg-1" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-fg-0">{t('leaderboard.settings', '排行榜设置')}</h2>
              <p className="text-sm text-fg-2">
                {t('leaderboard.settingsDesc', '管理您的排行榜参与设置')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isLoggedIn ? (
            <div className="py-6 rounded-md bg-bg-2/60 text-center">
              <p className="text-fg-2 text-sm">
                {t('leaderboard.loginRequired', '登录云同步账号后可参与排行榜')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 参与排行榜开关 */}
              <div className="flex items-center justify-between p-4 rounded-md border border-border/60">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-fg-2 shrink-0" />
                  <div>
                    <div className="font-medium text-sm text-fg-0">
                      {t('leaderboard.participateLabel', '参与排行榜统计')}
                    </div>
                    <div className="text-xs text-fg-2 mt-0.5">
                      {t('leaderboard.participateDesc', '开启后您的抽卡数据将参与排行统计')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleParticipate()}
                  disabled={settingsLoading}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                    settings?.participate
                      ? 'bg-green-500'
                      : 'bg-bg-3 border border-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all ${
                      settings?.participate
                        ? 'left-[26px] bg-white'
                        : 'left-0.5 bg-fg-2/60'
                    }`}
                  />
                </button>
              </div>

              {/* 隐藏 UID 开关 */}
              <div className="flex items-center justify-between p-4 rounded-md border border-border/60">
                <div className="flex items-center gap-3">
                  {settings?.hideUid ? (
                    <EyeOff size={18} className="text-fg-2 shrink-0" />
                  ) : (
                    <Eye size={18} className="text-fg-2 shrink-0" />
                  )}
                  <div>
                    <div className="font-medium text-sm text-fg-0">
                      {t('leaderboard.hideUidLabel', '隐藏 UID')}
                    </div>
                    <div className="text-xs text-fg-2 mt-0.5">
                      {t('leaderboard.hideUidDesc', '开启后排行榜上只显示 UID 后四位')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleHideUid()}
                  disabled={settingsLoading || !settings?.participate}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                    !settings?.participate
                      ? 'bg-bg-3 border border-border opacity-40 cursor-not-allowed'
                      : settings?.hideUid
                        ? 'bg-green-500'
                        : 'bg-bg-3 border border-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all ${
                      settings?.hideUid
                        ? 'left-[26px] bg-white'
                        : 'left-0.5 bg-fg-2/60'
                    }`}
                  />
                </button>
              </div>

              {/* 提示信息 */}
              <div className="p-3 rounded-md bg-bg-2/60 text-xs text-fg-2 leading-relaxed">
                {t(
                  'leaderboard.settingsNote',
                  '注意：排行榜数据每 5 分钟更新一次，设置更改后需等待下次更新才会生效。'
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LeaderboardPage;
