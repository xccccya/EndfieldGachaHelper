/**
 * 关于页面
 * 显示应用版本、开源声明、许可证等信息
 */

import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Info,
  ExternalLink,
  Code2,
  RefreshCw,
  Sparkles,
  Loader2,
  Scale,
  CheckCircle2,
  AlertCircle,
  Download,
  Heart,
  Github,
  Clock,
} from 'lucide-react';
import { useUpdate } from '../../hooks/update';
import { useAppInfo } from '../../hooks/useAppInfo';
import { Card, CardHeader, CardContent, Button, Badge, LegalModal } from '../components';

/** 开源软件许可证徽章组件 */
function OSSBadge({ name, license, url }: { name: string; license: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-3 hover:bg-brand/10 border border-border hover:border-brand/30 transition-all duration-200"
      title={`${name} - ${license}`}
    >
      <span className="text-xs font-medium text-fg-1 group-hover:text-brand transition-colors">{name}</span>
      <span className="text-[10px] px-1 py-0.5 rounded bg-fg-2/10 text-fg-2 font-mono">{license}</span>
      <ExternalLink size={10} className="text-fg-2 group-hover:text-brand transition-colors opacity-0 group-hover:opacity-100" />
    </a>
  );
}

export function AboutPage() {
  const { t } = useTranslation();
  const { version } = useAppInfo();
  
  // 用户协议弹窗
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');
  
  // 应用更新
  const { 
    status: updateStatus, 
    updateInfo, 
    progress: updateProgress, 
    error: updateError,
    lastCheckedAt,
    nextAutoCheckAt,
    checkForUpdate, 
    downloadAndInstall, 
    restartApp 
  } = useUpdate();

  const lastCheckedLabel = useMemo(() => {
    if (!lastCheckedAt) return t('updater.neverChecked', '未检查');
    try {
      return new Date(lastCheckedAt).toLocaleString();
    } catch {
      return String(lastCheckedAt);
    }
  }, [lastCheckedAt, t]);

  const nextCheckLabel = useMemo(() => {
    if (!nextAutoCheckAt) return t('updater.unknownNextCheck', '—');
    try {
      return new Date(nextAutoCheckAt).toLocaleString();
    } catch {
      return String(nextAutoCheckAt);
    }
  }, [nextAutoCheckAt, t]);

  const updateReleaseDateLabel = useMemo(() => {
    const raw = updateInfo?.date;
    if (!raw) return null;
    try {
      const d = new Date(raw);
      if (!Number.isFinite(d.getTime())) return raw;
      return d.toLocaleString(); // 系统时区时间
    } catch {
      return raw;
    }
  }, [updateInfo?.date]);
  
  // 打开协议弹窗
  const openLegalModal = useCallback((tab: 'terms' | 'privacy') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* 应用信息头部 */}
      <Card className="overflow-hidden">
        <div className="relative">
          {/* 装饰背景 */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-purple-500/10" />
          <div className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />
          
          <div className="relative px-6 py-8">
            <div className="flex items-center gap-6">
              {/* 应用图标 */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand/20 to-purple-500/20 p-1 shadow-lg shadow-brand/20 border border-brand/30">
                <img 
                  src="/icon.png" 
                  alt={t('common.appIconAlt')} 
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-fg-0 mb-1">
                  {t('app.title')}
                </h1>
                <p className="text-fg-2 text-sm mb-3">
                  {t('settings.aboutDesc')}
                </p>
                <div className="flex items-center gap-3">
                  <Badge variant="version">v{version}</Badge>
                  <span className="text-xs text-fg-2">{t('settings.techValue', 'Tauri + React + TypeScript')}</span>
                </div>
              </div>
              
              {/* 作者信息 */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20">
                <Heart size={14} className="text-brand" />
                <span className="text-xs text-fg-2">{t('settings.author', '作者')}</span>
                <span className="text-sm font-medium text-brand">@Yuki</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 版本更新 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
              <RefreshCw size={20} className="text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('about.versionUpdate', '版本更新')}</h2>
              <p className="text-sm text-fg-1">{t('about.versionUpdateDesc', '检查并安装最新版本')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-bg-2/70 overflow-hidden">
            {/* 顶部信息条：版本 + 操作 */}
            <div className="px-4 py-3 border-b border-border bg-bg-3/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-fg-2 text-sm shrink-0">{t('settings.version', '版本')}</span>
                  <Badge variant="version">v{version}</Badge>
                  <span className="text-xs text-fg-2/70 truncate">{t('updater.autoCheckEnabled', '自动检查：已启用')}</span>
                </div>

                {/* 右侧动作：根据状态展示按钮/状态 */}
                <div className="flex items-center gap-2 shrink-0">
                  {(updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void checkForUpdate('manual');
                      }}
                      icon={<RefreshCw size={14} />}
                    >
                      {t('settings.checkUpdate', '检查更新')}
                    </Button>
                  )}
                  {updateStatus === 'checking' && (
                    <div className="flex items-center gap-2 text-fg-2 text-sm px-3 py-2 rounded-md bg-bg-1/40 border border-border/50">
                      <Loader2 size={14} className="animate-spin" />
                      <span>{t('settings.checking', '检查中...')}</span>
                    </div>
                  )}
                  {updateStatus === 'downloading' && (
                    <div className="flex items-center gap-2 text-fg-2 text-sm px-3 py-2 rounded-md bg-bg-1/40 border border-border/50">
                      <Download size={14} className="text-brand" />
                      <span>{t('settings.downloading', '下载中...')}</span>
                    </div>
                  )}
                  {updateStatus === 'ready' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        void restartApp();
                      }}
                      icon={<RefreshCw size={14} />}
                    >
                      {t('settings.restartNow', '立即重启')}
                    </Button>
                  )}
                </div>
              </div>

              {/* 时间信息：更像“元信息 chips”，不挤占主区域 */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-1/30 border border-border/40">
                  <Clock size={12} className="text-fg-2" />
                  {t('updater.lastChecked', '上次检查')}: <span className="text-fg-0">{lastCheckedLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-1/30 border border-border/40">
                  <Clock size={12} className="text-fg-2" />
                  {t('updater.nextCheck', '下次检查')}: <span className="text-fg-0">{nextCheckLabel}</span>
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* 已是最新 */}
              {updateStatus === 'not-available' && (
                <div className="flex items-center justify-between gap-3 text-green-400 text-sm p-3 rounded-md bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>{t('settings.upToDate', '已是最新版本')}</span>
                  </div>
                </div>
              )}

              {/* 出错 */}
              {updateStatus === 'error' && updateError && (
                <div className="flex items-start justify-between gap-3 text-red-400 text-sm p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span className="break-words text-fg-0/90">{updateError}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void checkForUpdate('manual');
                    }}
                    className="text-red-300 hover:bg-red-500/10 border border-red-500/20"
                    icon={<RefreshCw size={14} />}
                  >
                    {t('common.retry', '重试')}
                  </Button>
                </div>
              )}

              {/* 有新版本可用 */}
              {updateStatus === 'available' && updateInfo && (
                <div className="rounded-md border border-brand/25 bg-brand/10 overflow-hidden">
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-brand">
                        <Sparkles size={14} />
                        <span className="font-semibold">
                          {t('settings.newVersion', '发现新版本')}: v{updateInfo.version}
                        </span>
                      </div>
                      {updateReleaseDateLabel ? <span className="text-xs text-fg-2">{updateReleaseDateLabel}</span> : null}
                    </div>
                    {updateInfo.body ? (
                      <div className="mt-2 rounded-md bg-bg-3/50 border border-border/60 p-3 text-xs text-fg-1 max-h-48 overflow-y-auto">
                        <div className="font-medium text-fg-0 mb-1">{t('settings.updateNotes', '更新说明')}</div>
                        <div className="whitespace-pre-wrap">{updateInfo.body}</div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            void downloadAndInstall();
                          }}
                          icon={<Download size={14} />}
                        >
                          {t('settings.downloadUpdate', '下载更新')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            void checkForUpdate('manual');
                          }}
                          icon={<RefreshCw size={14} />}
                        >
                          {t('updater.recheck', '重新检查')}
                        </Button>
                      </div>
                      <span className="text-xs text-fg-2">{t('updater.downloadHint', '下载完成后将自动重启并安装')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 下载中 */}
              {updateStatus === 'downloading' && (
                <div className="rounded-md border border-border/60 bg-bg-1/40 p-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-fg-2">{t('settings.downloading', '下载中...')}</span>
                    <span className="text-brand font-medium">{updateProgress}%</span>
                  </div>
                  <div className="h-2 bg-bg-3 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-sm transition-all duration-300"
                      style={{ width: `${updateProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 准备重启 */}
              {updateStatus === 'ready' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm p-3 rounded-md bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 size={14} />
                    <span>{t('settings.downloadComplete', '下载完成，重启以完成更新')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        void restartApp();
                      }}
                      icon={<RefreshCw size={14} />}
                    >
                      {t('settings.restartNow', '立即重启')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void checkForUpdate('manual');
                      }}
                      icon={<RefreshCw size={14} />}
                    >
                      {t('updater.recheck', '重新检查')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 开源软件声明 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Code2 size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('settings.openSource', '开源软件声明')}</h2>
              <p className="text-sm text-fg-1">{t('settings.openSourceDesc', '本软件基于以下开源项目构建，特此致谢：')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 核心框架 */}
            <div className="p-3 rounded-lg bg-bg-2/50 border border-border/50">
              <div className="text-xs font-medium text-fg-1 mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                {t('settings.ossCoreFramework', '核心框架')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <OSSBadge name="Tauri" license="MIT/Apache-2.0" url="https://tauri.app" />
                <OSSBadge name="React" license="MIT" url="https://react.dev" />
                <OSSBadge name="TypeScript" license="Apache-2.0" url="https://typescriptlang.org" />
              </div>
            </div>
            
            {/* UI 相关 */}
            <div className="p-3 rounded-lg bg-bg-2/50 border border-border/50">
              <div className="text-xs font-medium text-fg-1 mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                {t('settings.ossUILibs', 'UI 组件')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <OSSBadge name="Tailwind CSS" license="MIT" url="https://tailwindcss.com" />
                <OSSBadge name="Lucide Icons" license="ISC" url="https://lucide.dev" />
                <OSSBadge name="React Router" license="MIT" url="https://reactrouter.com" />
              </div>
            </div>
            
            {/* 工具库 */}
            <div className="p-3 rounded-lg bg-bg-2/50 border border-border/50">
              <div className="text-xs font-medium text-fg-1 mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {t('settings.ossUtils', '工具库')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <OSSBadge name="i18next" license="MIT" url="https://i18next.com" />
                <OSSBadge name="Vite" license="MIT" url="https://vitejs.dev" />
                <OSSBadge name="Serde" license="MIT/Apache-2.0" url="https://serde.rs" />
              </div>
            </div>
            
            <p className="text-xs text-fg-2 leading-relaxed px-1">
              {t('settings.ossNotice', '以上开源项目均遵循各自的开源许可证。完整依赖列表及许可证详情请查阅项目源代码。')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 开源许可证 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Scale size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('settings.license', '开源许可')}</h2>
              <p className="text-sm text-fg-1">{t('settings.licenseDesc', '本项目基于 Apache License 2.0 协议开源')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-brand/5 to-purple-500/5 border border-brand/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Github size={18} className="text-fg-1" />
                <span className="text-sm text-fg-1">{t('settings.licenseLabel')}:</span>
                <span className="text-sm px-2 py-0.5 rounded bg-brand/10 text-brand font-mono font-medium">
                  {t('settings.licenseType', 'Apache-2.0')}
                </span>
              </div>
            </div>
            <a
              href="https://www.apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-brand hover:text-brand-hover hover:bg-brand/10 border border-brand/30 hover:border-brand/50 transition-all duration-200"
            >
              {t('settings.viewLicense', '查看许可证')}
              <ExternalLink size={14} />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* 法律声明与协议 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fg-2/20 flex items-center justify-center">
              <Info size={20} className="text-fg-2" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('about.legal', '法律声明')}</h2>
              <p className="text-sm text-fg-1">{t('about.legalDesc', '免责声明与用户协议')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 免责声明 */}
            <div className="p-4 rounded-lg bg-bg-2/50 border border-border/50 text-sm text-fg-2 leading-relaxed">
              {t('settings.disclaimer')}
            </div>
            
            {/* 用户协议与隐私政策链接 */}
            <div className="flex items-center justify-center gap-4 py-2">
              <button
                type="button"
                onClick={() => openLegalModal('terms')}
                className="flex items-center gap-1.5 text-brand hover:text-brand-hover transition-colors text-sm font-medium"
              >
                <ExternalLink size={14} />
                {t('legal.termsLink', '《用户协议》')}
              </button>
              <span className="text-fg-2">|</span>
              <button
                type="button"
                onClick={() => openLegalModal('privacy')}
                className="flex items-center gap-1.5 text-brand hover:text-brand-hover transition-colors text-sm font-medium"
              >
                <ExternalLink size={14} />
                {t('legal.privacyLink', '《隐私政策》')}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 打赏作者 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-xl">☕</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('settings.supportAuthor', '打赏作者')}</h2>
              <p className="text-sm text-fg-1">{t('settings.supportAuthorDesc', '如果这个工具对你有帮助，可以请作者喝杯咖啡~')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative group">
              <div className="absolute -inset-3 bg-gradient-to-r from-brand/20 via-purple-500/20 to-amber-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-3 bg-white rounded-xl shadow-lg border border-border/50 group-hover:border-brand/30 transition-colors">
                <img
                  src="/3dc7266d7c084465e28021865519ab53.png"
                  alt={t('settings.supportAuthor', '打赏作者')}
                  className="w-40 h-40 object-contain"
                />
              </div>
            </div>
            <span className="text-xs text-fg-2/60">{t('settings.scanToSupport', '微信扫码打赏')}</span>
          </div>
        </CardContent>
      </Card>
      
      {/* 用户协议与隐私政策弹窗 */}
      <LegalModal
        open={legalModalOpen}
        onOpenChange={setLegalModalOpen}
        initialTab={legalModalTab}
      />
    </div>
  );
}

export default AboutPage;
