/**
 * 排行榜页面
 * 展示累计抽数、六星数、歪数排行榜
 */

import { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge } from '../components';
import { useSyncConfig } from '../../hooks/useSync';
import { useLeaderboard, useLeaderboardSettings } from '../../hooks/useLeaderboard';
import type { LeaderboardEntry, LeaderboardType } from '@efgachahelper/shared';

// 排行榜类型配置
const LEADERBOARD_TABS: {
  type: LeaderboardType;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}[] = [
  {
    type: 'total_pulls',
    labelKey: 'leaderboard.totalPulls',
    icon: <Hash size={18} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  {
    type: 'six_star_count',
    labelKey: 'leaderboard.sixStarCount',
    icon: <Star size={18} />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  {
    type: 'off_banner_count',
    labelKey: 'leaderboard.offBannerCount',
    icon: <Shuffle size={18} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
];

// 排名图标
function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Crown size={20} className="text-yellow-400" />;
  }
  if (rank === 2) {
    return <Medal size={20} className="text-gray-300" />;
  }
  if (rank === 3) {
    return <Award size={20} className="text-amber-600" />;
  }
  return <span className="w-5 text-center font-mono text-fg-2">{rank}</span>;
}

// 排行榜条目组件
function LeaderboardItem({
  entry,
  isMe,
  valueLabel,
}: {
  entry: LeaderboardEntry;
  isMe?: boolean;
  valueLabel: string;
}) {
  return (
    <div
      className={`
        flex items-center gap-4 px-4 py-3 rounded-lg transition-all
        ${isMe ? 'bg-brand/10 border border-brand/30' : 'bg-bg-2/50 hover:bg-bg-2'}
      `}
    >
      {/* 排名 */}
      <div className="w-8 flex items-center justify-center">
        <RankIcon rank={entry.rank} />
      </div>

      {/* UID 和区服 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm ${isMe ? 'text-brand font-semibold' : 'text-fg-0'}`}>
            {entry.displayUid}
          </span>
          {entry.uidHidden && (
            <EyeOff size={12} className="text-fg-2" title="UID已隐藏" />
          )}
          {isMe && (
            <Badge className="bg-brand/20 text-brand text-xs">我</Badge>
          )}
        </div>
        <div className="text-xs text-fg-2 mt-0.5">
          {entry.region}
        </div>
      </div>

      {/* 数值 */}
      <div className="text-right">
        <div className="text-lg font-bold text-fg-0">
          {entry.value.toLocaleString()}
        </div>
        <div className="text-xs text-fg-2">{valueLabel}</div>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { isLoggedIn } = useSyncConfig();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('total_pulls');

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

  // 获取当前 Tab 的排行榜数据
  const currentLeaderboard = leaderboardData?.[
    activeTab === 'total_pulls'
      ? 'totalPulls'
      : activeTab === 'six_star_count'
        ? 'sixStarCount'
        : 'offBannerCount'
  ];

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

  return (
    <div className="space-y-4">
      {/* 排行榜头部 */}
      <Card>
        <CardHeader accent noBorder>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
              <Trophy size={20} className="text-brand" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{t('leaderboard.title', '排行榜')}</h2>
              <p className="text-sm text-fg-1">
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
      <div className="flex gap-2 p-1 bg-bg-1 rounded-lg border border-border">
        {LEADERBOARD_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => setActiveTab(tab.type)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md
              text-sm font-medium transition-all
              ${activeTab === tab.type
                ? `${tab.bgColor} ${tab.color}`
                : 'text-fg-1 hover:bg-bg-2 hover:text-fg-0'
              }
            `}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* 排行榜内容 */}
      <Card>
        <CardContent className="p-0">
          {leaderboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-brand" />
              <span className="ml-2 text-fg-1">{t('common.loading', '加载中...')}</span>
            </div>
          ) : leaderboardError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle size={32} className="text-red-400 mb-2" />
              <p className="text-fg-1">{t('leaderboard.loadError', '加载失败')}</p>
              <p className="text-sm text-fg-2 mt-1">{leaderboardError}</p>
            </div>
          ) : !currentLeaderboard || currentLeaderboard.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users size={32} className="text-fg-2 mb-2" />
              <p className="text-fg-1">{t('leaderboard.noEntries', '暂无排行数据')}</p>
              <p className="text-sm text-fg-2 mt-1">
                {t('leaderboard.beFirst', '成为第一个参与排行的用户吧！')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* 我的排名（如果在榜上） */}
              {currentLeaderboard.myRank && currentLeaderboard.myValue !== undefined && (
                <div className="p-4 bg-brand/5 border-b border-brand/20">
                  <div className="flex items-center gap-2 text-sm text-brand mb-2">
                    <Trophy size={14} />
                    <span>{t('leaderboard.myRank', '我的排名')}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-brand">
                      #{currentLeaderboard.myRank}
                    </div>
                    <div className="text-fg-1">
                      {currentLeaderboard.myValue.toLocaleString()} {getValueLabel(activeTab)}
                    </div>
                  </div>
                </div>
              )}

              {/* 排行榜列表 */}
              <div className="p-4 space-y-2">
                {currentLeaderboard.entries.map((entry) => (
                  <LeaderboardItem
                    key={`${entry.rank}-${entry.displayUid}`}
                    entry={entry}
                    isMe={currentLeaderboard.myRank === entry.rank}
                    valueLabel={getValueLabel(activeTab)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 用户设置（需要登录） */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fg-2/20 flex items-center justify-center">
              <Settings2 size={20} className="text-fg-1" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{t('leaderboard.settings', '排行榜设置')}</h2>
              <p className="text-sm text-fg-1">
                {t('leaderboard.settingsDesc', '管理您的排行榜参与设置')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isLoggedIn ? (
            <div className="p-4 rounded-md bg-bg-2 text-center">
              <p className="text-fg-1">
                {t('leaderboard.loginRequired', '登录云同步账号后可参与排行榜')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 参与排行榜开关 */}
              <div className="flex items-center justify-between p-4 rounded-md border border-border">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-fg-2" />
                  <div>
                    <div className="font-medium text-fg-0">
                      {t('leaderboard.participateLabel', '参与排行榜统计')}
                    </div>
                    <div className="text-sm text-fg-2">
                      {t('leaderboard.participateDesc', '开启后您的抽卡数据将参与排行统计')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleParticipate()}
                  disabled={settingsLoading}
                  className={`relative w-14 h-7 rounded-full transition-all duration-200 shrink-0 ${
                    settings?.participate
                      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                      : 'bg-bg-3 border-2 border-fg-2/50'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
                      settings?.participate ? 'left-8 bg-white' : 'left-1 bg-fg-2'
                    }`}
                  />
                </button>
              </div>

              {/* 隐藏 UID 开关 */}
              <div className="flex items-center justify-between p-4 rounded-md border border-border">
                <div className="flex items-center gap-3">
                  {settings?.hideUid ? (
                    <EyeOff size={20} className="text-fg-2" />
                  ) : (
                    <Eye size={20} className="text-fg-2" />
                  )}
                  <div>
                    <div className="font-medium text-fg-0">
                      {t('leaderboard.hideUidLabel', '隐藏 UID')}
                    </div>
                    <div className="text-sm text-fg-2">
                      {t('leaderboard.hideUidDesc', '开启后排行榜上只显示 UID 后四位')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleHideUid()}
                  disabled={settingsLoading || !settings?.participate}
                  className={`relative w-14 h-7 rounded-full transition-all duration-200 shrink-0 ${
                    !settings?.participate
                      ? 'bg-bg-3 border-2 border-fg-2/30 opacity-50 cursor-not-allowed'
                      : settings?.hideUid
                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                        : 'bg-bg-3 border-2 border-fg-2/50'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
                      settings?.hideUid ? 'left-8 bg-white' : 'left-1 bg-fg-2'
                    }`}
                  />
                </button>
              </div>

              {/* 提示信息 */}
              <div className="p-3 rounded-md bg-bg-2 text-sm text-fg-2">
                <p>
                  {t(
                    'leaderboard.settingsNote',
                    '注意：排行榜数据每 5 分钟更新一次，设置更改后需等待下次更新才会生效。'
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LeaderboardPage;
