/**
 * 设置页面
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  Download,
  Upload,
  Trash2,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Info,
  FolderOpen,
  Languages,
  ChevronDown,
  Check,
  ExternalLink,
  Code2,
  RefreshCw,
  Sparkles,
  Loader2,
  Scale,
} from 'lucide-react';
import { useUpdater } from '../../hooks/useUpdater';
import { Card, CardHeader, CardContent, Button, Badge, ConfirmDialog, Popover, LegalModal } from '../components';
import { useAccounts } from '../../hooks/useEndfield';
import { markForceFullDownload } from '../../hooks/useSync';
import {
  exportData,
  importData,
  exportAllRecordsToCSV,
  importRecordsFromCSV,
  clearGachaRecords,
  clearWeaponRecords,
  getGachaRecords,
  getWeaponRecords,
  type ExportData,
} from '../../lib/storage';

/** 支持的语言列表 */
const LANGUAGES = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
] as const;

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

type MessageState = {
  type: 'success' | 'error';
  text: string;
  filePath?: string; // 导出文件路径
};

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { activeUid, activeAccount, accounts } = useAccounts();
  const [message, setMessage] = useState<MessageState | null>(null);
  const [exporting, setExporting] = useState(false);
  
  // 语言选择器状态
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langButtonRef = useRef<HTMLButtonElement>(null);

  // 清除记录确认弹窗
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  
  // 用户协议弹窗
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');
  
  // 应用更新
  const { 
    status: updateStatus, 
    updateInfo, 
    progress: updateProgress, 
    error: updateError,
    checkForUpdate, 
    downloadAndInstall, 
    restartApp 
  } = useUpdater();
  
  // 打开协议弹窗
  const openLegalModal = useCallback((tab: 'terms' | 'privacy') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  }, []);

  // 切换语言
  const handleLanguageChange = useCallback((langCode: string) => {
    void i18n.changeLanguage(langCode);
    setLangMenuOpen(false);
  }, [i18n]);

  // 获取当前语言信息
  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  // JSON 导出
  const handleExportJSON = useCallback(() => {
    void (async () => {
      setExporting(true);
      try {
        const data = exportData();
        const fileName = `endfield-gacha-${new Date().toISOString().split('T')[0]}.endfieldgacha.json`;
        
        // 使用 Tauri 对话框选择保存位置
        const filePath = await save({
          defaultPath: fileName,
          filters: [{ name: 'JSON', extensions: ['json', 'endfieldgacha.json'] }],
        });
        
        if (filePath) {
          await writeTextFile(filePath, JSON.stringify(data, null, 2));
          setMessage({ 
            type: 'success', 
            text: t('settings.exportSuccess'),
            filePath,
          });
        }
      } catch (err) {
        console.error('导出失败:', err);
        setMessage({ type: 'error', text: t('settings.exportError') });
      } finally {
        setExporting(false);
      }
    })();
  }, [t]);

  // CSV 导出
  const handleExportCSV = useCallback(() => {
    void (async () => {
      setExporting(true);
      try {
        const csvContent = exportAllRecordsToCSV();
        const fileName = `endfield-gacha-${new Date().toISOString().split('T')[0]}.csv`;
        
        // 使用 Tauri 对话框选择保存位置
        const filePath = await save({
          defaultPath: fileName,
          filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
        
        if (filePath) {
          // 添加 BOM 以支持 Excel 正确识别 UTF-8
          const bom = '\uFEFF';
          await writeTextFile(filePath, bom + csvContent);
          setMessage({ 
            type: 'success', 
            text: t('settings.csvExportSuccess'),
            filePath,
          });
        }
      } catch (err) {
        console.error('CSV 导出失败:', err);
        setMessage({ type: 'error', text: t('settings.exportError') });
      } finally {
        setExporting(false);
      }
    })();
  }, [t]);

  // 打开文件所在目录
  const handleOpenFolder = useCallback(async (filePath: string) => {
    try {
      await revealItemInDir(filePath);
    } catch (err) {
      console.error('打开文件夹失败:', err);
    }
  }, []);

  // JSON 导入
  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.endfieldgacha.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;
        const result = importData(data);
        
        setMessage({
          type: 'success',
          text: t('settings.importSuccess', { 
            accounts: result.accounts, 
            records: result.charRecords + result.weaponRecords,
          }),
        });
      } catch {
        setMessage({ type: 'error', text: t('settings.importError') });
      }
    };

    input.click();
  }, [t]);

  // CSV 导入
  const handleImportCSV = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = importRecordsFromCSV(text);
        
        if (result.errors.length > 0) {
          setMessage({
            type: 'error',
            text: result.errors.join('；'),
          });
        } else {
          setMessage({
            type: 'success',
            text: t('settings.csvImportSuccess', {
              charRecords: result.charRecords,
              weaponRecords: result.weaponRecords,
            }),
          });
        }
      } catch {
        setMessage({ type: 'error', text: t('settings.importError') });
      }
    };

    input.click();
  }, [t]);

  const handleClearRecords = useCallback(() => {
    if (!activeUid) return;
    setClearDialogOpen(true);
  }, [activeUid]);

  const charRecordCount = activeUid ? getGachaRecords(activeUid).length : 0;
  const weaponRecordCount = activeUid ? getWeaponRecords(activeUid).length : 0;
  const recordCount = charRecordCount + weaponRecordCount;
  const totalCharRecords = getGachaRecords().length;
  const totalWeaponRecords = getWeaponRecords().length;

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={clearDialogOpen}
        title={t('settings.clearCurrentTitle')}
        description={t('settings.confirmClear')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
        icon={<Trash2 size={18} />}
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={() => {
          if (!activeUid) return;
          clearGachaRecords(activeUid);
          clearWeaponRecords(activeUid);
          // 下一次云同步对该 uid 强制全量下载，避免 since 增量过滤导致下载为 0
          markForceFullDownload(activeUid);
          setClearDialogOpen(false);
          setMessage({ type: 'success', text: t('settings.clearSuccess') });
        }}
      />

      {/* 消息提示 - 修复遮挡问题 */}
      {message && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={20} className="text-green-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <span className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>
              {message.text}
            </span>
            {/* 显示导出文件路径和打开文件夹按钮 */}
            {message.filePath && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-fg-2 truncate flex-1" title={message.filePath}>
                  {message.filePath}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { void handleOpenFolder(message.filePath!); }}
                  icon={<FolderOpen size={16} />}
                  className="shrink-0"
                >
                  {t('settings.openFolder')}
                </Button>
              </div>
            )}
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-fg-2 hover:text-fg-0 shrink-0"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* JSON 数据导出导入 */}
      <Card>
        <CardHeader accent>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
              <FileJson size={20} className="text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('settings.dataTitle')}</h2>
              <p className="text-sm text-fg-1">{t('settings.dataDesc')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 数据概览 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-bg-2">
                <div className="text-2xl font-bold text-brand">{accounts.length}</div>
                <div className="text-sm text-fg-1">{t('settings.totalAccounts')}</div>
              </div>
              <div className="p-4 rounded-lg bg-bg-2">
                <div className="text-2xl font-bold text-fg-0">{totalCharRecords}</div>
                <div className="text-sm text-fg-1">{t('settings.charRecords')}</div>
              </div>
              <div className="p-4 rounded-lg bg-bg-2">
                <div className="text-2xl font-bold text-fg-0">{totalWeaponRecords}</div>
                <div className="text-sm text-fg-1">{t('settings.weaponRecords')}</div>
              </div>
            </div>

            {/* JSON 导出导入按钮 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-fg-0 flex items-center gap-2">
                <FileJson size={16} className="text-brand" />
                JSON {t('settings.format')}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleExportJSON}
                  loading={exporting}
                  icon={<Download size={18} />}
                  className="flex-1"
                >
                  {t('settings.exportJSON')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleImportJSON}
                  icon={<Upload size={18} />}
                  className="flex-1 border border-brand/25 hover:border-brand/45 hover:bg-bg-3/80"
                >
                  {t('settings.importJSON')}
                </Button>
              </div>
            </div>

            {/* CSV 导出导入按钮 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-fg-0 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-green-500" />
                CSV {t('settings.format')}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleExportCSV}
                  loading={exporting}
                  icon={<Download size={18} />}
                  className="flex-1"
                >
                  {t('settings.exportCSV')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleImportCSV}
                  icon={<Upload size={18} />}
                  className="flex-1 border border-brand/25 hover:border-brand/45 hover:bg-bg-3/80"
                >
                  {t('settings.importCSV')}
                </Button>
              </div>
            </div>

            {/* 说明 */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-sm text-blue-400">
              <Info size={16} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>{t('settings.dataInfo')}</div>
                <div>{t('settings.csvInfo')}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 危险操作 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-red-400">{t('settings.dangerZone')}</h2>
              <p className="text-sm text-fg-1">{t('settings.dangerDesc')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeAccount && (
              <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                <div>
                  <div className="font-medium">{t('settings.clearCurrentTitle')}</div>
                  <div className="text-sm text-fg-2">
                    {t('settings.clearCurrentDesc', {
                      name: activeAccount.roles[0]?.nickName || activeAccount.uid,
                      count: recordCount,
                    })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={handleClearRecords}
                  disabled={recordCount === 0}
                  className="text-red-400 hover:bg-red-500/10"
                  icon={<Trash2 size={18} />}
                >
                  {t('settings.clearRecords')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 语言设置 */}
      <Card className="relative overflow-visible">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Languages size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('settings.language')}</h2>
              <p className="text-sm text-fg-1">{t('settings.languageDesc')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-visible">
          <div className="relative">
            <button
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border bg-bg-2 transition-all duration-200 ${
                langMenuOpen 
                  ? 'border-brand/50 bg-bg-3' 
                  : 'border-border hover:border-brand/50 hover:bg-bg-3'
              }`}
              type="button"
              ref={langButtonRef}
              onClick={() => setLangMenuOpen((v) => !v)}
              aria-expanded={langMenuOpen}
            >
              <span className="text-xl">{currentLang.flag}</span>
              <span className="flex-1 text-left font-medium">{currentLang.name}</span>
              <ChevronDown 
                size={18} 
                className={`text-fg-2 transition-transform duration-200 ${langMenuOpen ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {/* 语言选择下拉菜单：Portal 渲染，默认向下展开且不被遮挡 */}
            <Popover
              open={langMenuOpen}
              onOpenChange={setLangMenuOpen}
              anchorEl={langButtonRef.current}
              matchAnchorWidth
              placement="bottom-start"
            >
              <div className="py-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      i18n.language === lang.code
                        ? 'bg-brand/10 text-brand'
                        : 'text-fg-1 hover:bg-bg-2'
                    }`}
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    <span className="text-xl">{lang.flag}</span>
                    <span className="flex-1 text-left font-medium">{lang.name}</span>
                    {i18n.language === lang.code && (
                      <Check size={18} className="text-brand" />
                    )}
                  </button>
                ))}
              </div>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-fg-2/20 flex items-center justify-center">
                <Info size={20} className="text-fg-2" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('settings.about')}</h2>
                <p className="text-sm text-fg-1">{t('settings.aboutDesc')}</p>
              </div>
            </div>
            {/* 作者信息 */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20">
              <span className="text-xs text-fg-2">{t('settings.author', '作者')}</span>
              <span className="text-sm font-medium text-brand">@Yuki</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {/* 版本号与检查更新 */}
            <div className="p-4 rounded-lg bg-bg-2/80 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-fg-2">{t('settings.version')}</span>
                  <Badge variant="brand">v0.1.0</Badge>
                </div>
                
                {/* 检查更新按钮 */}
                {updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { void checkForUpdate(); }}
                    className="text-brand hover:bg-brand/10"
                    icon={<RefreshCw size={14} />}
                  >
                    {t('settings.checkUpdate', '检查更新')}
                  </Button>
                ) : updateStatus === 'checking' ? (
                  <div className="flex items-center gap-2 text-fg-2 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('settings.checking', '检查中...')}</span>
                  </div>
                ) : null}
              </div>
              
              {/* 更新状态显示 */}
              {updateStatus === 'not-available' && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle2 size={14} />
                  <span>{t('settings.upToDate', '已是最新版本')}</span>
                </div>
              )}
              
              {updateStatus === 'error' && updateError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={14} />
                  <span>{updateError}</span>
                </div>
              )}
              
              {/* 有新版本可用 */}
              {updateStatus === 'available' && updateInfo && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-brand">
                    <Sparkles size={14} />
                    <span className="font-medium">
                      {t('settings.newVersion', '发现新版本')}: v{updateInfo.version}
                    </span>
                  </div>
                  {updateInfo.body && (
                    <div className="p-3 rounded-md bg-bg-3 text-fg-2 text-xs max-h-32 overflow-y-auto">
                      <div className="font-medium text-fg-1 mb-1">{t('settings.updateNotes', '更新说明')}:</div>
                      <div className="whitespace-pre-wrap">{updateInfo.body}</div>
                    </div>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { void downloadAndInstall(); }}
                    icon={<Download size={14} />}
                  >
                    {t('settings.downloadUpdate', '下载更新')}
                  </Button>
                </div>
              )}
              
              {/* 下载中 */}
              {updateStatus === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-fg-2">{t('settings.downloading', '下载中...')}</span>
                    <span className="text-brand font-medium">{updateProgress}%</span>
                  </div>
                  <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand rounded-full transition-all duration-300"
                      style={{ width: `${updateProgress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* 准备重启 */}
              {updateStatus === 'ready' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 size={14} />
                    <span>{t('settings.downloadComplete', '下载完成，重启以完成更新')}</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { void restartApp(); }}
                    icon={<RefreshCw size={14} />}
                  >
                    {t('settings.restartNow', '立即重启')}
                  </Button>
                </div>
              )}
            </div>
            
            <div className="flex justify-between">
              <span className="text-fg-2">{t('settings.tech')}</span>
              <span className="text-fg-1">Tauri + React + TypeScript</span>
            </div>
            
            {/* 开源软件声明 */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <Code2 size={16} className="text-brand" />
                <span className="text-sm font-medium text-fg-0">{t('settings.openSource', '开源软件声明')}</span>
              </div>
              <p className="text-xs text-fg-2 mb-3">
                {t('settings.openSourceDesc', '本软件基于以下开源项目构建，特此致谢：')}
              </p>
              <div className="grid gap-2">
                {/* 核心框架 */}
                <div className="p-2.5 rounded-lg bg-bg-2/50">
                  <div className="text-xs font-medium text-fg-1 mb-1.5">{t('settings.ossCoreFramework', '核心框架')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <OSSBadge name="Tauri" license="MIT/Apache-2.0" url="https://tauri.app" />
                    <OSSBadge name="React" license="MIT" url="https://react.dev" />
                    <OSSBadge name="TypeScript" license="Apache-2.0" url="https://typescriptlang.org" />
                  </div>
                </div>
                {/* UI 相关 */}
                <div className="p-2.5 rounded-lg bg-bg-2/50">
                  <div className="text-xs font-medium text-fg-1 mb-1.5">{t('settings.ossUILibs', 'UI 组件')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <OSSBadge name="Tailwind CSS" license="MIT" url="https://tailwindcss.com" />
                    <OSSBadge name="Lucide Icons" license="ISC" url="https://lucide.dev" />
                    <OSSBadge name="React Router" license="MIT" url="https://reactrouter.com" />
                  </div>
                </div>
                {/* 工具库 */}
                <div className="p-2.5 rounded-lg bg-bg-2/50">
                  <div className="text-xs font-medium text-fg-1 mb-1.5">{t('settings.ossUtils', '工具库')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <OSSBadge name="i18next" license="MIT" url="https://i18next.com" />
                    <OSSBadge name="Vite" license="MIT" url="https://vitejs.dev" />
                    <OSSBadge name="Serde" license="MIT/Apache-2.0" url="https://serde.rs" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-fg-2 mt-3 leading-relaxed">
                {t('settings.ossNotice', '以上开源项目均遵循各自的开源许可证。完整依赖列表及许可证详情请查阅项目源代码。')}
              </p>
            </div>
            
            {/* 开源许可证 */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-brand/5 to-purple-500/5 border border-brand/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
                    <Scale size={16} className="text-brand" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg-0">{t('settings.license', '开源许可')}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-brand/10 text-brand font-mono">
                        {t('settings.licenseType', 'Apache-2.0')}
                      </span>
                    </div>
                    <p className="text-xs text-fg-2 mt-0.5">
                      {t('settings.licenseDesc', '本项目基于 Apache License 2.0 协议开源')}
                    </p>
                  </div>
                </div>
                <a
                  href="https://www.apache.org/licenses/LICENSE-2.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-brand hover:text-brand-hover hover:bg-brand/10 transition-all duration-200"
                >
                  {t('settings.viewLicense', '查看许可证')}
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
            
            <div className="pt-3 border-t border-border text-fg-2">
              {t('settings.disclaimer')}
            </div>
            {/* 用户协议与隐私政策链接 */}
            <div className="pt-3 border-t border-border flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => openLegalModal('terms')}
                className="text-brand hover:text-brand-hover transition-colors text-sm"
              >
                {t('legal.termsLink', '《用户协议》')}
              </button>
              <span className="text-fg-2">|</span>
              <button
                type="button"
                onClick={() => openLegalModal('privacy')}
                className="text-brand hover:text-brand-hover transition-colors text-sm"
              >
                {t('legal.privacyLink', '《隐私政策》')}
              </button>
            </div>
            
            {/* 打赏作者 */}
            <div className="pt-4 border-t border-border">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">☕</span>
                  <span className="text-sm font-medium text-fg-0">{t('settings.supportAuthor', '打赏作者')}</span>
                </div>
                <p className="text-xs text-fg-2 text-center">
                  {t('settings.supportAuthorDesc', '如果这个工具对你有帮助，可以请作者喝杯咖啡~')}
                </p>
                <div className="relative group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-brand/20 via-purple-500/20 to-brand/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-2 bg-white rounded-lg shadow-lg border border-border/50 group-hover:border-brand/30 transition-colors">
                    <img
                      src="/3dc7266d7c084465e28021865519ab53.png"
                      alt={t('settings.supportAuthor', '打赏作者')}
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-fg-2/60">{t('settings.scanToSupport', '微信扫码打赏')}</span>
              </div>
            </div>
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

export default SettingsPage;
