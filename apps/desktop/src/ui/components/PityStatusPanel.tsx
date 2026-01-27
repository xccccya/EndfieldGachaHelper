/**
 * 保底状态面板组件
 * 显示6星保底、5星保底、UP大保底等信息
 */

import { AlertCircle, TrendingUp, Star, Sparkles, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PityStatus } from '../../lib/poolUtils';

export type PityStatusPanelProps = {
  pityStatus: PityStatus;
  /** 是否为限定池（限定池才有大保底） */
  isSpecialPool?: boolean;
  /** 去掉外侧边框（用于“共享保底”等嵌套场景） */
  borderless?: boolean;
  /** 额外容器样式 */
  className?: string;
};

export function PityStatusPanel({
  pityStatus,
  isSpecialPool = true,
  borderless = false,
  className,
}: PityStatusPanelProps) {
  const { t } = useTranslation();
  const {
    pityTo6Star,
    pityTo5Star,
    pityToUp6Star,
    currentStreak,
    isInProbBoostZone,
    isHardPity,
    lastSixStarWasUp,
    hasSixStarInPool,
  } = pityStatus;
  
  // 6星保底进度百分比
  const sixStarProgress = Math.min((pityTo6Star / 80) * 100, 100);
  // 5星保底进度百分比
  const fiveStarProgress = Math.min((pityTo5Star / 10) * 100, 100);
  // UP大保底进度百分比
  const upProgress = Math.min((pityToUp6Star / 120) * 100, 100);
  
  // 保底状态颜色
  const getSixStarColor = () => {
    if (isHardPity) return 'text-red-500';
    if (isInProbBoostZone) return 'text-orange-500';
    if (pityTo6Star > 50) return 'text-yellow-500';
    return 'text-green-500';
  };
  
  const getSixStarBgColor = () => {
    if (isHardPity) return 'bg-red-500';
    if (isInProbBoostZone) return 'bg-orange-500';
    if (pityTo6Star > 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  return (
    <div
      className={[
        'space-y-3 p-4 bg-bg-2/50 rounded-md',
        borderless ? '' : 'border border-border/50',
        className ?? '',
      ].join(' ')}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm font-medium text-fg-0">
        <TrendingUp size={16} className="text-purple-400" />
        <span>{t('stats.ui.pityPanel.title')}</span>
      </div>
      
      {/* 保底进度 */}
      <div className="space-y-3">
        {/* 6星小保底 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Star size={14} className={getSixStarColor()} />
              <span className="text-fg-1">{t('stats.ui.pityPanel.toSixStar')}</span>
            </div>
            <span className={`font-medium ${getSixStarColor()}`}>
              {pityTo6Star}/80 {t('stats.pulls')}
            </span>
          </div>
          <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getSixStarBgColor()} transition-all duration-300`}
              style={{ width: `${sixStarProgress}%` }}
            />
          </div>
          {isInProbBoostZone && (
            <div className="flex items-center gap-1 text-xs text-orange-400">
              <AlertCircle size={12} />
              <span>{t('stats.ui.pityPanel.probBoostHint')}</span>
            </div>
          )}
          {isHardPity && (
            <div className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle size={12} />
              <span>{t('stats.ui.pityPanel.hardPityHint')}</span>
            </div>
          )}
        </div>
        
        {/* 5星保底 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-fg-1">{t('stats.ui.pityPanel.toFiveStar')}</span>
            </div>
            <span className={`font-medium ${pityTo5Star >= 10 ? 'text-red-500' : 'text-amber-400'}`}>
              {pityTo5Star}/10 {t('stats.pulls')}
            </span>
          </div>
          <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
            <div 
              className={`h-full ${pityTo5Star >= 10 ? 'bg-red-500' : 'bg-amber-500'} transition-all duration-300`}
              style={{ width: `${fiveStarProgress}%` }}
            />
          </div>
        </div>
        
        {/* UP大保底（仅限定池） */}
        {isSpecialPool && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Target size={14} className="text-purple-400" />
                <span className="text-fg-1">{t('stats.ui.pityPanel.toUpHardPity')}</span>
              </div>
              <span className={`font-medium ${pityToUp6Star >= 120 ? 'text-red-500' : 'text-purple-400'}`}>
                {pityToUp6Star}/120 {t('stats.pulls')}
              </span>
            </div>
            <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
              <div 
                className={`h-full ${pityToUp6Star >= 120 ? 'bg-red-500' : 'bg-purple-500'} transition-all duration-300`}
                style={{ width: `${upProgress}%` }}
              />
            </div>
            <div className="text-xs text-fg-2">
              {!hasSixStarInPool 
                ? t('stats.ui.pityPanel.upNoSixStarHint')
                : lastSixStarWasUp 
                  ? t('stats.ui.pityPanel.upLastWasUpHint')
                  : t('stats.ui.pityPanel.upLastWasOffHint')}
            </div>
          </div>
        )}
      </div>
      
      {/* 已垫抽数提示 */}
      {currentStreak > 0 && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-2">{t('stats.ui.pityPanel.currentStreak')}</span>
            <span className="font-medium text-purple-400">{currentStreak} {t('stats.pulls')}</span>
          </div>
        </div>
      )}
      
      {/* 保底继承提示 */}
      <div className="pt-2 border-t border-border/50 space-y-1 text-xs text-fg-2">
        <div className="flex items-center gap-1">
          <AlertCircle size={12} className="text-blue-400 flex-shrink-0" />
          <span>{t('stats.ui.pityPanel.inheritTitle')}</span>
        </div>
        {isSpecialPool && (
          <div className="flex items-center gap-1">
            <AlertCircle size={12} className="text-orange-400 flex-shrink-0" />
            <span>{t('stats.ui.pityPanel.upRule')}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <AlertCircle size={12} className="text-green-400 flex-shrink-0" />
          <span>{t('stats.ui.pityPanel.freeNotCounted')}</span>
        </div>
      </div>
    </div>
  );
}
