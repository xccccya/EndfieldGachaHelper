import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useUpdate } from '../../hooks/update';

export function UpdateToast() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, updateInfo, progress, toastOpen, setToastOpen, downloadAndInstall, restartApp } = useUpdate();

  const visible = toastOpen && (status === 'available' || status === 'downloading' || status === 'ready');
  const title = useMemo(() => {
    if (status === 'ready') return t('updater.toastReadyTitle', '更新已准备就绪');
    if (status === 'downloading') return t('updater.toastDownloadingTitle', '正在下载更新…');
    return t('updater.toastAvailableTitle', '发现新版本');
  }, [status, t]);

  const subtitle = useMemo(() => {
    if (status === 'ready') return t('updater.toastReadyDesc', '点击重启完成更新');
    if (status === 'downloading') return t('updater.toastDownloadingDesc', '请稍候，下载完成后将提示重启');
    const v = updateInfo?.version ? `v${updateInfo.version}` : '';
    return t('updater.toastAvailableDesc', '版本 {{version}} 已发布', { version: v });
  }, [status, t, updateInfo?.version]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[10002] w-[360px] max-w-[calc(100vw-40px)]">
      <div className="relative rounded-lg border border-border bg-bg-1 shadow-xl overflow-hidden">
        {/* 顶部装饰条 */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand/80 via-purple-500/60 to-brand/20" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={[
                'mt-0.5 w-10 h-10 rounded-md flex items-center justify-center shrink-0 border',
                status === 'ready'
                  ? 'bg-green-500/12 text-green-400 border-green-500/30'
                  : status === 'downloading'
                    ? 'bg-blue-500/12 text-blue-400 border-blue-500/30'
                    : 'bg-brand/12 text-brand border-brand/30',
              ].join(' ')}
            >
              {status === 'ready' ? <RefreshCw size={18} /> : status === 'downloading' ? <Download size={18} /> : <Sparkles size={18} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-fg-0">{title}</div>
                  <div className="mt-0.5 text-xs text-fg-1">{subtitle}</div>
                </div>
                <button
                  type="button"
                  className="text-fg-2 hover:text-fg-0 transition-colors"
                  aria-label={t('common.dismiss', '关闭')}
                  onClick={() => setToastOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              {status === 'downloading' ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-fg-1 mb-1">
                    <span>{t('settings.downloading', '下载中...')}</span>
                    <span className="text-blue-400 font-medium">{progress}%</span>
                  </div>
                  <div className="h-2 bg-bg-3 rounded-sm overflow-hidden">
                    <div className="h-full bg-blue-400/90 rounded-sm transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                {status === 'available' ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        void downloadAndInstall().then(() => {
                          // 下载开始后保持 toast 打开显示进度
                          setToastOpen(true);
                        });
                      }}
                      icon={<Download size={14} />}
                    >
                      {t('settings.downloadUpdate', '下载更新')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setToastOpen(false);
                        void navigate('/about');
                      }}
                    >
                      {t('updater.toastViewDetails', '查看详情')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setToastOpen(false)}>
                      {t('updater.toastLater', '稍后')}
                    </Button>
                  </>
                ) : null}

                {status === 'ready' ? (
                  <>
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
                        setToastOpen(false);
                        void navigate('/about');
                      }}
                    >
                      {t('updater.toastViewDetails', '查看详情')}
                    </Button>
                  </>
                ) : null}

                {status === 'downloading' ? (
                  <Button variant="secondary" size="sm" onClick={() => void navigate('/about')}>
                    {t('updater.toastViewDetails', '查看详情')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateToast;

