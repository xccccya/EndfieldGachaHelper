/**
 * 云同步配置页面
 * 管理同步账号登录和同步设置
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Cloud,
  CloudOff,
  LogOut,
  User,
  Mail,
  Calendar,
  RefreshCw,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Settings,
  Database,
  Users,
  Sword,
  EyeOff,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, ConfirmDialog, SyncAuthModal } from '../components';
import { useSyncConfig, useSyncAuth, useSyncHealth, useAutoSync, useCloudSyncStatus } from '../../hooks/useSync';
import { formatDistanceToNow } from '../../lib/dateUtils';

export function CloudSyncPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { status, user, isLoggedIn, autoSync, lastSyncAt, syncError } = useSyncConfig();
  const { logout, toggleAutoSync, manualSync, cleanupDuplicates } = useSyncAuth();
  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ deleted: number } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    uploaded: { characters: number; weapons: number };
    downloaded: { characters: number; weapons: number };
  } | null>(null);
  const { isHealthy, checking, checkHealth } = useSyncHealth();
  const { status: cloudStatus, refresh: refreshCloudStatus } = useCloudSyncStatus();
  
  // 启用自动同步
  useAutoSync();
  
  // 弹窗状态
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // 支持外部（例如托盘菜单）触发：打开云同步页后直接弹出登录弹窗
  useEffect(() => {
    const shouldOpenAuth = searchParams.get('auth') === '1';
    if (!shouldOpenAuth) return;

    if (!isLoggedIn) {
      setAuthModalOpen(true);
    }

    // 清理 query 参数，避免重复触发
    const next = new URLSearchParams(searchParams);
    next.delete('auth');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isLoggedIn]);
  
  // 处理登出
  const handleLogout = useCallback(async () => {
    await logout();
    setLogoutDialogOpen(false);
  }, [logout]);
  
  // 处理手动同步
  const handleManualSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await manualSync();
      setSyncResult(result);
      // 同步成功后刷新云端状态
      if (result.success) {
        void refreshCloudStatus();
      }
    } finally {
      setSyncing(false);
    }
  }, [manualSync, refreshCloudStatus]);

  // 处理清理重复记录
  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    setCleanResult(null);
    try {
      const result = await cleanupDuplicates();
      setCleanResult(result);
      // 清理后刷新云端状态
      void refreshCloudStatus();
    } finally {
      setCleaning(false);
    }
  }, [cleanupDuplicates, refreshCloudStatus]);
  
  // 清除同步结果提示（5秒后自动清除）
  useEffect(() => {
    if (syncResult) {
      const timer = setTimeout(() => setSyncResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [syncResult]);

  // 清除清理结果提示（5秒后自动清除）
  useEffect(() => {
    if (cleanResult) {
      const timer = setTimeout(() => setCleanResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [cleanResult]);
  
  // 状态文本
  const statusText = {
    not_logged_in: t('cloudSync.statusNotLoggedIn', '未登录'),
    disabled: t('cloudSync.statusDisabled', '已登录（同步关闭）'),
    enabled: t('cloudSync.statusEnabled', '同步已启用'),
    syncing: t('cloudSync.statusSyncing', '正在同步...'),
    error: t('cloudSync.statusError', '连接异常'),
  };
  
  // 状态颜色
  const statusColor = {
    not_logged_in: 'bg-fg-2/20 text-fg-2',
    disabled: 'bg-orange-500/20 text-orange-400',
    enabled: 'bg-green-500/20 text-green-400',
    syncing: 'bg-blue-500/20 text-blue-400',
    error: 'bg-red-500/20 text-red-400',
  };
  
  return (
    <div className="space-y-4">
      {/* 认证弹窗 */}
      <SyncAuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        initialMode="login"
      />
      
      {/* 登出确认弹窗 */}
      <ConfirmDialog
        open={logoutDialogOpen}
        title={t('cloudSync.logoutTitle', '退出登录')}
        description={t('cloudSync.logoutDesc', '退出登录后，已同步的数据将保留在云端。您可以随时重新登录以继续同步。')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
        icon={<LogOut size={18} />}
        onCancel={() => setLogoutDialogOpen(false)}
        onConfirm={() => { void handleLogout(); }}
      />
      
      {/* 服务状态 */}
      <Card>
        <CardHeader accent noBorder>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isHealthy === null ? 'bg-fg-2/20' : isHealthy ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {checking ? (
                <Loader2 size={20} className="text-fg-1 animate-spin" />
              ) : isHealthy ? (
                <Cloud size={20} className="text-green-400" />
              ) : (
                <CloudOff size={20} className="text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{t('cloudSync.serviceTitle', '同步服务')}</h2>
              <p className="text-sm text-fg-1">
                {checking
                  ? t('cloudSync.checking', '正在检查服务状态...')
                  : isHealthy
                    ? t('cloudSync.serviceOnline', '服务运行正常')
                    : t('cloudSync.serviceOffline', '服务暂时不可用')
                }
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void checkHealth(); }}
              disabled={checking}
              icon={<RefreshCw size={16} className={checking ? 'animate-spin' : ''} />}
            >
              {t('cloudSync.refresh', '刷新')}
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      {/* 账号状态 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isLoggedIn ? 'bg-brand/20' : 'bg-fg-2/20'
            }`}>
              <User size={20} className={isLoggedIn ? 'text-brand' : 'text-fg-2'} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{t('cloudSync.accountTitle', '同步账号')}</h2>
              <p className="text-sm text-fg-1">
                {isLoggedIn
                  ? t('cloudSync.loggedInAs', '已登录')
                  : t('cloudSync.notLoggedIn', '登录以启用云同步功能')
                }
              </p>
            </div>
            <Badge className={statusColor[status]}>
              {statusText[status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoggedIn && user ? (
            <div className="space-y-4">
              {/* 账号信息 */}
              <div className="p-4 rounded-md bg-bg-2 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md bg-brand/20 flex items-center justify-center text-brand font-bold text-lg border border-brand/30">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-fg-0 flex items-center gap-2">
                      <Mail size={14} className="text-fg-2" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    {user.createdAt && (
                      <div className="text-sm text-fg-2 flex items-center gap-2 mt-1">
                        <Calendar size={14} />
                        <span>
                          {t('cloudSync.createdAt', '注册于')} {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 云端数据统计 */}
              {cloudStatus && cloudStatus.accounts.length > 0 && (
                <div className="p-4 rounded-md bg-bg-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-fg-0">
                      <Database size={16} className="text-brand" />
                      <span>{t('cloudSync.cloudData', '云端数据')}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { void handleCleanup(); }}
                      disabled={cleaning}
                      className="text-xs"
                    >
                      {cleaning ? t('cloudSync.cleaning', '清理中...') : t('cloudSync.cleanDuplicates', '清理重复')}
                    </Button>
                  </div>
                  {cloudStatus.accounts.map((account) => (
                    <div key={`${account.uid}-${account.region}`} className="flex items-center gap-4 text-sm">
                      <span className="text-fg-2 font-mono">{account.uid}</span>
                      <div className="flex items-center gap-3 ml-auto">
                        <span className="flex items-center gap-1 text-fg-1">
                          <Users size={14} className="text-blue-400" />
                          {account.characterCount}
                        </span>
                        <span className="flex items-center gap-1 text-fg-1">
                          <Sword size={14} className="text-orange-400" />
                          {account.weaponCount}
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* 清理结果提示 */}
                  {cleanResult && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 text-sm text-green-400">
                      <CheckCircle2 size={14} />
                      <span>
                        {cleanResult.deleted > 0
                          ? t('cloudSync.cleanedRecords', { count: cleanResult.deleted })
                          : t('cloudSync.noCleanNeeded')}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* 同步操作 */}
              <div className="p-4 rounded-md border border-border space-y-4">
                {/* 手动同步按钮 */}
                <Button
                  variant="accent"
                  className="w-full"
                  onClick={() => { void handleManualSync(); }}
                  disabled={syncing}
                  icon={syncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                >
                  {syncing ? t('cloudSync.syncing', '正在同步...') : t('cloudSync.syncNow', '立即同步')}
                </Button>
                
                {/* 同步结果提示 */}
                {syncResult && (
                  <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${
                    syncResult.success 
                      ? 'bg-green-500/10 text-green-400' 
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {syncResult.success ? (
                      <>
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <div>{t('cloudSync.syncSuccess', '同步完成')}</div>
                          <div className="text-xs mt-1 opacity-80">
                            {t('cloudSync.uploaded', '上传')}: {syncResult.uploaded.characters + syncResult.uploaded.weapons} 条 | {' '}
                            {t('cloudSync.downloaded', '下载')}: {syncResult.downloaded.characters + syncResult.downloaded.weapons} 条
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{t('cloudSync.syncFailed', '同步失败')}</span>
                      </>
                    )}
                  </div>
                )}
                
                {/* 最近同步时间 */}
                <div className="flex items-center gap-2 text-sm text-fg-2">
                  {lastSyncAt ? (
                    <>
                      <CheckCircle2 size={14} className="text-green-400" />
                      <span>
                        {t('cloudSync.lastSync', '上次同步')}: {formatDistanceToNow(lastSyncAt)}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-fg-2" />
                      <span>{t('cloudSync.neverSynced', '尚未同步')}</span>
                    </>
                  )}
                </div>
                
                {/* 自动同步开关 */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="text-fg-2" />
                    <div>
                      <span className="text-sm">{t('cloudSync.autoSync', '自动同步')}</span>
                      <p className="text-xs text-fg-2 mt-0.5">
                        {t('cloudSync.autoSyncDesc', '启动时同步，数据变化时自动上传，每 5 分钟检查更新')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAutoSync(!autoSync)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-200 shrink-0 ${
                      autoSync 
                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                        : 'bg-bg-3 border-2 border-fg-2/50'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
                        autoSync ? 'left-8 bg-white' : 'left-1 bg-fg-2'
                      }`}
                    />
                  </button>
                </div>
                
                {syncError && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 text-sm text-red-400">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{syncError}</span>
                  </div>
                )}
              </div>
              
              {/* 登出按钮 */}
              <Button
                variant="ghost"
                onClick={() => setLogoutDialogOpen(true)}
                className="w-full text-red-400 hover:bg-red-500/10"
                icon={<LogOut size={18} />}
              >
                {t('cloudSync.logout', '退出登录')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 登录过期提示 */}
              {syncError && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-orange-500/10 text-sm text-orange-400">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{syncError}</span>
                </div>
              )}
              
              {/* 未登录提示 */}
              <div className="p-6 rounded-md bg-bg-2 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto">
                  <Cloud size={32} className="text-brand" />
                </div>
                <div>
                  <h3 className="font-semibold text-fg-0 mb-1">
                    {t('cloudSync.welcomeTitle', '开启云同步')}
                  </h3>
                  <p className="text-sm text-fg-1">
                    {t('cloudSync.welcomeDesc', '登录后可将抽卡记录同步到云端，多设备随时查看')}
                  </p>
                </div>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => setAuthModalOpen(true)}
                  className="w-full"
                  icon={<User size={18} />}
                >
                  {t('cloudSync.loginOrRegister', '登录 / 注册')}
                </Button>
              </div>
              
              {/* 功能说明 */}
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-md bg-bg-2">
                  <Shield size={18} className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-fg-0 text-sm">
                      {t('cloudSync.featureSecurity', '安全加密')}
                    </div>
                    <div className="text-xs text-fg-2">
                      {t('cloudSync.featureSecurityDesc', '数据加密传输，保护您的隐私')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md bg-bg-2">
                  <RefreshCw size={18} className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-fg-0 text-sm">
                      {t('cloudSync.featureMultiDevice', '多端同步')}
                    </div>
                    <div className="text-xs text-fg-2">
                      {t('cloudSync.featureMultiDeviceDesc', '在不同设备上查看同一份数据')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md bg-bg-2">
                  <Settings size={18} className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-fg-0 text-sm">
                      {t('cloudSync.featureBackup', '云端备份')}
                    </div>
                    <div className="text-xs text-fg-2">
                      {t('cloudSync.featureBackupDesc', '防止本地数据丢失，随时恢复')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md bg-bg-2">
                  <EyeOff size={18} className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-fg-0 text-sm">
                      {t('cloudSync.featurePrivacy', '隐私保护')}
                    </div>
                    <div className="text-xs text-fg-2">
                      {t('cloudSync.featurePrivacyDesc', '不上传您的账号密钥数据，只传本地分析完成的抽卡数据')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CloudSyncPage;
