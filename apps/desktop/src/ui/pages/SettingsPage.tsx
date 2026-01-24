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
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, ConfirmDialog, Popover } from '../components';
import { useAccounts } from '../../hooks/useEndfield';
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
                  className="flex-1"
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
                  className="flex-1"
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fg-2/20 flex items-center justify-center">
              <Info size={20} className="text-fg-2" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('settings.about')}</h2>
              <p className="text-sm text-fg-1">{t('settings.aboutDesc')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-fg-2">{t('settings.version')}</span>
              <Badge variant="brand">v0.1.0</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-2">{t('settings.tech')}</span>
              <span className="text-fg-1">Tauri + React + TypeScript</span>
            </div>
            <div className="pt-3 border-t border-border text-fg-2">
              {t('settings.disclaimer')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
