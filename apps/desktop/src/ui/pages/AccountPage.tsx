/**
 * 账号管理页面
 * 添加 Token、选择 UID、管理账号
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  UserPlus,
  Key,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
  User,
  Server,
  LogIn,
  ExternalLink,
  Info,
  CheckCircle2,
  Globe,
  ArrowRight,
  Shield,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, ConfirmDialog, Modal } from '../components';
import { useAuth, useAccounts } from '../../hooks/useEndfield';
import { removeAccount, parseAccountKey, getAccountProviderPreference, setAccountProviderPreference } from '../../lib/storage';

type AccountProvider = 'hypergryph' | 'gryphline';

function providerMeta(provider: AccountProvider) {
  if (provider === 'gryphline') {
    return {
      websiteUrl: 'https://user.gryphline.com/',
      websiteHost: 'user.gryphline.com',
      tokenApiUrl: 'https://web-api.gryphline.com/cookie_store/account_token',
    };
  }
  return {
    websiteUrl: 'https://user.hypergryph.com/',
    websiteHost: 'user.hypergryph.com',
    tokenApiUrl: 'https://web-api.hypergryph.com/account/info/hg',
  };
}

// 使用 Tauri opener 打开外部链接
const openExternal = async (url: string) => {
  try {
    await openUrl(url);
  } catch (error) {
    console.error('Failed to open URL:', error);
    // Fallback: 尝试使用 window.open
    window.open(url, '_blank');
  }
};

export function AccountPage() {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [provider, setProvider] = useState<AccountProvider>(() => getAccountProviderPreference());
  const [showSuccess, setShowSuccess] = useState(false);
  const { loading, error, authenticate, clearError } = useAuth();
  const { accounts, activeUid, selectAccount, refresh } = useAccounts();
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const providerName =
    provider === 'gryphline' ? t('account.providerNameGryphline') : t('account.providerNameHypergryph');

  // Token 获取提示卡
  const [tokenHelpOpen, setTokenHelpOpen] = useState(false);
  const tokenHelpButtonRef = useRef<HTMLButtonElement>(null);

  const handleAddAccount = useCallback(() => {
    if (!token.trim()) return;

    void (async () => {
      try {
        await authenticate(token.trim(), provider);
        setToken('');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        refresh();
      } catch {
        // Error handled by useAuth
      }
    })();
  }, [token, provider, authenticate, refresh]);

  const toggleProvider = useCallback(() => {
    const next: AccountProvider = provider === 'hypergryph' ? 'gryphline' : 'hypergryph';
    setProvider(next);
    setAccountProviderPreference(next);
  }, [provider]);

  const ProviderSwitch = useCallback((props: { className?: string }) => {
    const className = props.className ?? '';
    const isGryphline = provider === 'gryphline';
    return (
      <button
        type="button"
        onClick={toggleProvider}
        aria-pressed={isGryphline}
        className={`
          group inline-flex items-center gap-2
          rounded-full
          px-2.5 py-1.5
          bg-bg-3/85 hover:bg-bg-3
          dark:bg-bg-2/70 dark:hover:bg-bg-2/95
          backdrop-blur-sm
          shadow-md
          shadow-black/5 dark:shadow-black/30
          transition-all duration-200
          hover:shadow-lg
          focus:outline-none focus:ring-2 focus:ring-brand/35 dark:focus:ring-brand/45
          active:scale-[0.985]
          ${className}
        `}
      >
        <span
          className={`
            text-xs font-semibold whitespace-nowrap select-none
            ${isGryphline ? 'text-sky-400 dark:text-sky-300' : 'text-brand'}
          `}
        >
          {t('account.useProvider', { providerName })}
        </span>
        <span
          className={`
            relative inline-flex h-5 w-9 items-center rounded-full
            shadow-inner
            transition-colors duration-250 ease-out
            ${isGryphline
              ? 'bg-sky-500/25 dark:bg-sky-400/20'
              : 'bg-brand/28 dark:bg-brand/22'}
          `}
        >
          {/* 轻微高光层（随 hover 更明显） */}
          <span
            className={`
              pointer-events-none absolute inset-0 rounded-full
              bg-gradient-to-b from-white/20 to-transparent
              opacity-70 group-hover:opacity-95
              transition-opacity duration-200
            `}
          />
          <span
            className={`
              absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow
              transition-all duration-250 ease-out
              group-active:scale-95
              ${isGryphline
                ? 'translate-x-4 bg-sky-400 dark:bg-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.28)]'
                : 'translate-x-0 bg-brand shadow-[0_0_10px_rgba(255,250,0,0.25)]'}
            `}
          />
        </span>
      </button>
    );
  }, [provider, providerName, t, toggleProvider]);

  const handleRemoveAccount = useCallback((uid: string) => {
    setDeleteUid(uid);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && token.trim() && !loading) {
      handleAddAccount();
    }
  }, [token, loading, handleAddAccount]);

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={deleteUid !== null}
        title={t('common.confirm')}
        description={t('account.confirmDelete')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
        icon={<Trash2 size={18} />}
        onCancel={() => setDeleteUid(null)}
        onConfirm={() => {
          if (!deleteUid) return;
          void (async () => {
            await removeAccount(deleteUid);
            setDeleteUid(null);
            refresh();
          })();
        }}
      />

      {/* 成功提示 Toast - 修复标题栏遮挡问题（标题栏高度 38px） */}
      {showSuccess && (
        <div className="fixed top-14 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-green-500/90 text-white shadow-lg backdrop-blur-sm">
            <CheckCircle2 size={20} />
            <span className="font-medium">{t('account.addSuccess')}</span>
          </div>
        </div>
      )}

      {/* 添加账号卡片 */}
      <Card>
        <CardHeader accent>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-brand/20 flex items-center justify-center border border-brand/30">
              <UserPlus size={24} className="text-brand" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('account.addTitle')}</h2>
              <p className="text-sm text-fg-1 mt-0.5">
                {t('account.addDesc', { providerName })}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* Token 输入区域 */}
            <div className="space-y-3">
              <Input
                label={t('account.tokenLabel')}
                labelRight={(
                  <ProviderSwitch />
                )}
                placeholder={t('account.tokenPlaceholder', { providerName })}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={handleKeyDown}
                icon={<Key size={18} />}
                error={error || undefined}
                disabled={loading}
              />
              
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={16} className="shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={clearError}
                    className="text-red-400/70 hover:text-red-400 transition-colors"
                  >
                    {t('common.dismiss')}
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={handleAddAccount}
                  loading={loading}
                  disabled={!token.trim()}
                  icon={<LogIn size={20} />}
                >
                  {loading ? t('account.verifying') : t('account.addButton')}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  type="button"
                  ref={tokenHelpButtonRef}
                  onClick={() => setTokenHelpOpen((v) => !v)}
                  icon={<Info size={20} />}
                  className="border border-brand/25 hover:border-brand/45 hover:bg-bg-3/80"
                >
                  {t('account.howToGetToken')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token 获取提示卡（居中大号 Modal） */}
      <Modal
        open={tokenHelpOpen}
        onOpenChange={setTokenHelpOpen}
        maxWidthClassName="max-w-4xl"
        backdrop="light"
      >
        <div className="p-6 space-y-6 bg-bg-1">
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold text-fg-0 flex items-center gap-2.5">
              <Info size={18} className="text-brand" />
              {t('account.howToGetToken')}
            </div>
            <div className="flex items-center gap-2">
              {/* 平台切换（教程内也可切换） */}
              <ProviderSwitch className="px-3" />

              <button
                type="button"
                onClick={() => setTokenHelpOpen(false)}
                className="
                  group
                  inline-flex items-center justify-center
                  w-9 h-9 rounded-md
                  text-fg-2 hover:text-fg-0 hover:bg-bg-3
                  transition-all duration-150
                  active:scale-95
                "
                aria-label={t('common.dismiss')}
              >
                <X
                  size={18}
                  className="transition-transform duration-200 group-hover:rotate-90"
                />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* 步骤说明 */}
            <div className="space-y-4">
              <div className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-md bg-brand/20 text-brand flex items-center justify-center text-sm font-bold border border-brand/30 group-hover:bg-brand/30 transition-colors">
                    1
                  </div>
                  <div className="w-0.5 h-full bg-border mt-2" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-fg-0 font-medium mb-1.5">
                    {t('account.step1Title', { providerName })}
                  </div>
                  <div className="text-sm text-fg-1 leading-relaxed">
                    {t('account.step1', { websiteHost: providerMeta(provider).websiteHost })}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-md bg-brand/20 text-brand flex items-center justify-center text-sm font-bold border border-brand/30 group-hover:bg-brand/30 transition-colors">
                    2
                  </div>
                  <div className="w-0.5 h-full bg-border mt-2" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-fg-0 font-medium mb-1.5">{t('account.step2Title')}</div>
                  <div className="text-sm text-fg-1 leading-relaxed">
                    {t('account.step2')}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-md bg-brand/20 text-brand flex items-center justify-center text-sm font-bold border border-brand/30 group-hover:bg-brand/30 transition-colors">
                    3
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-fg-0 font-medium mb-1.5">{t('account.step3Title')}</div>
                  <div className="text-sm text-fg-1 leading-relaxed">
                    {t('account.step3')}
                  </div>
                  <div className="mt-3 p-3 rounded-md bg-bg-1 border border-border font-mono text-xs text-fg-2 overflow-x-auto">
                    <span className="text-fg-2/60">{'{'}</span>
                    <span className="text-blue-400">"content"</span>
                    <span className="text-fg-2/60">: </span>
                    <span className="text-green-400">"{t('account.tokenExample')}"</span>
                    <span className="text-fg-2/60">{'}'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 快捷操作按钮 */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => { void openExternal(providerMeta(provider).websiteUrl); }}
                className="group flex-1 min-w-[180px] flex items-center gap-3 px-4 py-3.5 rounded-md bg-bg-1 border border-border text-fg-1 hover:border-brand/50 hover:bg-bg-2 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-md bg-fg-2/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors">
                  <Globe size={20} className="text-fg-2 group-hover:text-brand transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">
                    {provider === 'gryphline' ? t('account.openGryphlineWebsite') : t('account.openHgWebsite')}
                  </div>
                  <div className="text-xs text-fg-2 mt-0.5">{providerMeta(provider).websiteHost}</div>
                </div>
                <ExternalLink size={16} className="text-fg-2/50 group-hover:text-brand transition-colors" />
              </button>
              <button
                type="button"
                onClick={() => { void openExternal(providerMeta(provider).tokenApiUrl); }}
                className="group flex-1 min-w-[180px] flex items-center gap-3 px-4 py-3.5 rounded-md bg-brand/10 border border-brand/30 text-brand hover:bg-brand/20 hover:border-brand/50 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-md bg-brand/20 flex items-center justify-center group-hover:bg-brand/30 transition-colors">
                  <Key size={20} className="text-brand" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{t('account.openTokenApi')}</div>
                  <div className="text-xs text-brand/70 mt-0.5">{providerMeta(provider).tokenApiUrl}</div>
                </div>
                <ArrowRight size={16} className="text-brand/50 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            {/* 安全提示 */}
            <div className="flex items-start gap-3 p-3.5 rounded-md bg-green-500/5 border border-green-500/20">
              <Shield size={18} className="text-green-500 shrink-0 mt-0.5" />
              <div className="text-xs text-green-400/90 leading-relaxed">
                <span className="font-medium">{t('account.securityNotePrefix')}</span>
                {t('account.tokenHint')}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 已添加账号列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-md bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <User size={24} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t('account.listTitle')}</h2>
                <p className="text-sm text-fg-1 mt-0.5">
                  {t('account.listCount', { count: accounts.length })}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { refresh(); }} icon={<RefreshCw size={16} />}>
              {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12 text-fg-2">
              <div className="w-20 h-20 mx-auto mb-4 rounded-lg bg-fg-2/5 flex items-center justify-center">
                <User size={40} className="opacity-30" />
              </div>
              <p className="text-lg font-medium text-fg-1 mb-1">{t('account.emptyTitle')}</p>
              <p className="text-sm">{t('account.noAccounts')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.uid}
                  className={`
                    group flex items-center gap-4 p-4 rounded-md border transition-all cursor-pointer
                    ${activeUid === account.uid 
                      ? 'border-brand bg-brand/5 shadow-[0_0_0_1px_rgba(255,250,0,0.2)]' 
                      : 'border-border bg-bg-2 hover:border-fg-2/30 hover:bg-bg-2/80'
                    }
                  `}
                  onClick={() => { selectAccount(account.uid); }}
                >
                  {/* 头像 */}
                  <div className={`
                    w-14 h-14 rounded-md flex items-center justify-center text-xl font-bold transition-all
                    ${activeUid === account.uid 
                      ? 'bg-brand text-black shadow-lg shadow-brand/20' 
                      : 'bg-fg-2/10 text-fg-1 group-hover:bg-fg-2/20'
                    }
                  `}>
                    {account.roles[0]?.nickName?.charAt(0) || 'U'}
                  </div>

                  {/* 账号信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-lg truncate">
                        {account.roles[0]?.nickName ||
                          `${t('account.uidPrefix')}${account.roles[0]?.roleId || parseAccountKey(account.uid)?.roleId || account.uid}`}
                      </span>
                      {activeUid === account.uid && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/20 text-xs text-brand font-medium">
                          <Check size={12} />
                          {t('account.current')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-fg-2 mt-1.5">
                      <span className="flex items-center gap-1.5">
                        <Server size={14} className="text-fg-2/60" />
                        {account.channelName}
                      </span>
                      <span className="text-fg-2/60">•</span>
                      <span className="font-mono text-xs bg-fg-2/10 px-2 py-0.5 rounded">
                        {t('account.uidPrefix')}{account.roles[0]?.roleId || parseAccountKey(account.uid)?.roleId || account.uid}
                      </span>
                      {account.roles[0]?.level && (
                        <>
                          <span className="text-fg-2/60">•</span>
                          <span>{t('account.levelPrefix')}{account.roles[0].level}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAccount(account.uid);
                    }}
                    className="p-2.5 rounded-md text-fg-2/50 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    title={t('account.deleteAccountTitle')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountPage;
