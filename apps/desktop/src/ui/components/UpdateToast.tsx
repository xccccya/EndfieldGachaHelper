import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useUpdate } from '../../hooks/update';

export function UpdateToast() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, updateInfo, progress, toastOpen, setToastOpen, downloadAndInstall, restartApp, isPortable } = useUpdate();

  const visible = toastOpen && (status === 'available' || status === 'downloading' || status === 'ready');
  const title = useMemo(() => {
    if (status === 'ready') return t('updater.toastReadyTitle', '更新已准备就绪');
    if (status === 'downloading') return t('updater.toastDownloadingTitle', '正在下载更新…');
    return t('updater.toastAvailableTitle', '发现新版本');
  }, [status, t]);

  const subtitle = useMemo(() => {
    if (status === 'ready') return t('updater.toastReadyDesc', '点击重启完成更新');
    if (status === 'downloading') return t('updater.toastDownloadingDesc', '请稍候，下载完成后将自动重启并安装');
    const v = updateInfo?.version ? `v${updateInfo.version}` : '';
    return t('updater.toastAvailableDesc', '版本 {{version}} 已发布', { version: v });
  }, [status, t, updateInfo?.version]);

  if (!visible) return null;

  // 根据状态确定颜色方案
  const glowColor = status === 'ready' 
    ? 'rgba(34, 197, 94, 0.35)' 
    : status === 'downloading' 
      ? 'rgba(59, 130, 246, 0.35)' 
      : 'rgba(255, 250, 0, 0.3)';
  
  const topBarGradient = status === 'ready'
    ? 'linear-gradient(to right, #22c55e, #10b981, rgba(34, 197, 94, 0.4))'
    : status === 'downloading'
      ? 'linear-gradient(to right, #3b82f6, #06b6d4, rgba(59, 130, 246, 0.4))'
      : 'linear-gradient(to right, #fffa00, #fde047, rgba(255, 250, 0, 0.4))';

  const iconBgColor = status === 'ready' 
    ? 'rgba(34, 197, 94, 0.15)' 
    : status === 'downloading' 
      ? 'rgba(59, 130, 246, 0.15)' 
      : 'rgba(255, 250, 0, 0.12)';
  
  const iconRingColor = status === 'ready'
    ? 'rgba(34, 197, 94, 0.3)'
    : status === 'downloading'
      ? 'rgba(59, 130, 246, 0.3)'
      : 'rgba(255, 250, 0, 0.25)';

  return (
    <div className="fixed bottom-5 right-5 z-[10002] w-[360px] max-w-[calc(100vw-40px)]">
      {/* 外层发光效果 */}
      <div 
        className="absolute -inset-1.5 rounded-2xl blur-xl opacity-60"
        style={{ background: glowColor }}
      />
      
      {/* 主卡片 */}
      <div className="ef-update-toast relative rounded-xl overflow-hidden">
        {/* 顶部装饰条 */}
        <div 
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: topBarGradient }}
        />

        {/* 内部渐变装饰 */}
        <div className="ef-update-toast-overlay absolute inset-0 pointer-events-none" />

        <div className="relative p-4">
          <div className="flex items-start gap-3">
            {/* 图标容器 */}
            <div
              className="ef-update-toast-icon mt-0.5 w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
              data-status={status === 'ready' ? 'ready' : status === 'downloading' ? 'downloading' : 'available'}
              style={{
                backgroundColor: iconBgColor,
                boxShadow: `inset 0 0 0 1px ${iconRingColor}`,
              }}
            >
              {status === 'ready' ? <RefreshCw size={20} /> : status === 'downloading' ? <Download size={20} /> : <Sparkles size={20} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {/* 标题 */}
                  <div className="ef-update-toast-title text-sm font-semibold">
                    {title}
                  </div>
                  {/* 副标题 */}
                  <div className="ef-update-toast-subtitle mt-0.5 text-xs">
                    {subtitle}
                  </div>
                </div>
                <button
                  type="button"
                  className="ef-update-toast-close p-1.5 rounded-md transition-colors"
                  aria-label={t('common.dismiss', '关闭')}
                  onClick={() => setToastOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              {/* 下载进度条 */}
              {status === 'downloading' ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="ef-update-toast-subtitle">
                      {t('settings.downloading', '下载中...')}
                    </span>
                    <span className="font-semibold text-blue-400">{progress}%</span>
                  </div>
                  <div className="ef-update-toast-progress-bg h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${progress}%`,
                        background: 'linear-gradient(to right, #3b82f6, #06b6d4)',
                      }} 
                    />
                  </div>
                </div>
              ) : null}

              {/* 操作按钮 */}
              <div className="mt-3 flex items-center gap-2">
                {status === 'available' ? (
                  isPortable ? (
                    <>
                      <Button
                        variant="primary"
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
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          void downloadAndInstall().then(() => {
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
                  )
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
