/**
 * 同步页面
 * 拉取抽卡记录（角色 + 武器）
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Database,
  Clock,
  Sword,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge } from '../components';
import { useGachaSync, useAccounts } from '../../hooks/useEndfield';
import { getGachaRecords, getWeaponRecords } from '../../lib/storage';
import { formatDateShort } from '../../lib/dateUtils';

/** 卡池类型名称映射 */
const POOL_TYPE_NAMES: Record<string, string> = {
  // 角色池
  'E_CharacterGachaPoolType_Special': '角色限定池',
  'E_CharacterGachaPoolType_Standard': '角色常驻池',
  'E_CharacterGachaPoolType_Beginner': '角色新手池',
  // 武器池
  'E_WeaponGachaPoolType_Special': '武器限定池',
  'E_WeaponGachaPoolType_Standard': '武器常驻池',
};

/** 类别名称 */
const CATEGORY_NAMES: Record<string, string> = {
  'character': '角色',
  'weapon': '武器',
};

export function SyncPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { progress, syncRecords, reset } = useGachaSync();
  const { activeUid, activeAccount } = useAccounts();

  // 获取现有记录
  const existingCharRecords = useMemo(() => 
    activeUid ? getGachaRecords(activeUid) : [], 
  [activeUid]);
  
  const existingWeaponRecords = useMemo(() => 
    activeUid ? getWeaponRecords(activeUid) : [], 
  [activeUid]);
  
  const totalRecords = existingCharRecords.length + existingWeaponRecords.length;

  const handleSync = useCallback(async () => {
    if (!activeUid) {
      void navigate('/account');
      return;
    }

    try {
      await syncRecords(activeUid);
    } catch {
      // Error handled by hook
    }
  }, [activeUid, syncRecords, navigate]);

  const isLoading = progress.status === 'authenticating' || progress.status === 'fetching_records';

  return (
    <div className="space-y-4">
      {/* 同步状态卡片 */}
      <Card>
        <CardHeader accent>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
              <RefreshCw size={20} className="text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('sync.title')}</h2>
              <p className="text-sm text-fg-1">{t('sync.desc')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 当前账号 */}
          {activeAccount ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-bg-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold">
                {activeAccount.roles[0]?.nickName?.charAt(0) || 'U'}
              </div>
              <div className="flex-1">
                <div className="font-medium text-fg-0">
                  {activeAccount.roles[0]?.nickName || `UID: ${activeAccount.roles[0]?.roleId || activeAccount.uid}`}
                </div>
                <div className="text-sm text-fg-1">
                  {activeAccount.channelName} · UID: {activeAccount.roles[0]?.roleId || activeAccount.uid}
                </div>
              </div>
              <Badge variant="brand">{t('sync.currentAccount')}</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
              <AlertCircle size={20} className="text-yellow-400" />
              <div className="flex-1">
                <div className="font-medium text-yellow-400">{t('sync.noAccount')}</div>
                <div className="text-sm text-fg-2">{t('sync.noAccountHint')}</div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { void navigate('/account'); }}
                icon={<User size={16} />}
              >
                {t('sync.goAddAccount')}
              </Button>
            </div>
          )}

          {/* 同步进度 */}
          {isLoading && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 size={20} className="text-blue-400 animate-spin" />
                <span className="font-medium text-blue-400">
                  {progress.status === 'authenticating' 
                    ? t('sync.authenticating')
                    : t('sync.fetching')
                  }
                </span>
              </div>
              {progress.poolType && (
                <div className="text-sm text-fg-1 space-y-1">
                  {/* 当前类别 */}
                  {progress.category && (
                    <div className="flex justify-between">
                      <span>{t('sync.currentCategory')}</span>
                      <span className="text-fg-0 flex items-center gap-1">
                        {progress.category === 'weapon' ? (
                          <Sword size={14} />
                        ) : (
                          <User size={14} />
                        )}
                        {CATEGORY_NAMES[progress.category] || progress.category}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t('sync.currentPool')}</span>
                    <span className="text-fg-0">
                      {POOL_TYPE_NAMES[progress.poolType] || progress.poolType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('sync.progress')}</span>
                    <span className="text-fg-0">
                      {progress.poolIndex} / {progress.totalPools}
                    </span>
                  </div>
                  {progress.recordsFetched !== undefined && (
                    <div className="flex justify-between">
                      <span>{t('sync.fetched')}</span>
                      <span className="text-fg-0">{progress.recordsFetched}</span>
                    </div>
                  )}
                </div>
              )}
              {/* 进度条 */}
              <div className="mt-3 h-2 bg-bg-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: progress.totalPools 
                      ? `${((progress.poolIndex || 0) / progress.totalPools) * 100}%`
                      : '10%'
                  }}
                />
              </div>
            </div>
          )}

          {/* 完成状态 */}
          {progress.status === 'done' && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green-400" />
                <div className="flex-1">
                  <div className="font-medium text-green-400">{t('sync.success')}</div>
                  <div className="text-sm text-fg-2 space-y-0.5">
                    <div>{t('sync.successDetail', { count: progress.recordsFetched || 0 })}</div>
                    {(progress.charRecordsFetched !== undefined || progress.weaponRecordsFetched !== undefined) && (
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <User size={12} /> {t('sync.charRecords')}: {progress.charRecordsFetched || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Sword size={12} /> {t('sync.weaponRecords')}: {progress.weaponRecordsFetched || 0}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t('common.dismiss')}
                </Button>
              </div>
            </div>
          )}

          {/* 错误状态 */}
          {progress.status === 'error' && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-red-400" />
                <div className="flex-1">
                  <div className="font-medium text-red-400">{t('sync.error')}</div>
                  <div className="text-sm text-fg-2">{progress.error}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t('common.retry')}
                </Button>
              </div>
            </div>
          )}

          {/* 同步按钮 */}
          <div className="flex gap-3">
            <Button
              variant="accent"
              onClick={() => { void handleSync(); }}
              loading={isLoading}
              disabled={!activeAccount}
              icon={<Download size={18} />}
              className="flex-1"
            >
              {t('sync.startSync')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 本地数据统计 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Database size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('sync.localData')}</h2>
              <p className="text-sm text-fg-1">{t('sync.localDataDesc')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 总记录数 */}
            <div className="p-4 rounded-lg bg-bg-2 text-center">
              <div className="text-3xl font-bold text-brand">{totalRecords}</div>
              <div className="text-sm text-fg-1 mt-1">{t('sync.totalRecords')}</div>
            </div>
            {/* 角色记录数 */}
            <div className="p-4 rounded-lg bg-bg-2 text-center">
              <div className="text-2xl font-bold text-blue-400 flex items-center justify-center gap-1">
                <User size={20} />
                {existingCharRecords.length}
              </div>
              <div className="text-sm text-fg-1 mt-1">{t('sync.charRecords')}</div>
            </div>
            {/* 武器记录数 */}
            <div className="p-4 rounded-lg bg-bg-2 text-center">
              <div className="text-2xl font-bold text-orange-400 flex items-center justify-center gap-1">
                <Sword size={20} />
                {existingWeaponRecords.length}
              </div>
              <div className="text-sm text-fg-1 mt-1">{t('sync.weaponRecords')}</div>
            </div>
            {/* 最后同步时间 */}
            <div className="p-4 rounded-lg bg-bg-2 text-center">
              <div className="text-xl font-bold text-fg-0">
                {totalRecords > 0 
                  ? formatDateShort(
                      Math.max(
                        existingCharRecords[0]?.fetchedAt || 0,
                        existingWeaponRecords[0]?.fetchedAt || 0
                      )
                    )
                  : '-'
                }
              </div>
              <div className="text-sm text-fg-1 mt-1 flex items-center justify-center gap-1">
                <Clock size={14} />
                {t('sync.lastSync')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SyncPage;
