/**
 * 用户协议与隐私政策弹窗组件
 * 使用标签卡切换展示
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Shield, X } from 'lucide-react';
import { Modal } from './Modal';

type LegalTab = 'terms' | 'privacy';

type LegalModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: LegalTab;
};

export function LegalModal({ open, onOpenChange, initialTab = 'terms' }: LegalModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  const tabs = [
    { id: 'terms' as const, label: t('legal.termsTitle', '用户协议'), icon: FileText },
    { id: 'privacy' as const, label: t('legal.privacyTitle', '隐私政策'), icon: Shield },
  ];

  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidthClassName="max-w-2xl" backdrop="light">
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-border bg-bg-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand" />
              </div>
              <h2 className="text-lg font-bold text-fg-0">
                {t('legal.title', '用户协议与隐私政策')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-2 hover:text-fg-0 hover:bg-bg-2 transition-colors"
              aria-label={t('common.dismiss', '关闭')}
            >
              <X size={18} />
            </button>
          </div>

          {/* 标签切换 */}
          <div className="flex gap-1 mt-4 p-1 bg-bg-2 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-bg-1 text-brand shadow-sm'
                    : 'text-fg-2 hover:text-fg-1 hover:bg-bg-3/50'
                  }
                `}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 max-h-[60vh] bg-bg-1">
          {activeTab === 'terms' ? <TermsContent /> : <PrivacyContent />}
        </div>
      </div>
    </Modal>
  );
}

/** 用户协议内容 */
function TermsContent() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-fg-1 leading-relaxed">
      {/* 基本条款 */}
      <section>
        <h3 className="text-base font-semibold text-fg-0 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          {t('legal.terms.basicTitle', '基本条款')}
        </h3>
        <div className="space-y-3 pl-3.5 border-l-2 border-border">
          <p>
            <span className="font-medium text-fg-0">1. </span>
            {t('legal.terms.basic1', '本软件「终末地抽卡助手」仅用于统计与查看您的《明日方舟：终末地》游戏内寻访（抽卡）记录。数据源自鹰角官方寻访记录，本软件不完全确保数据的准确性，仅供参考使用。')}
          </p>
          <p>
            <span className="font-medium text-fg-0">2. </span>
            {t('legal.terms.basic2', '本软件仅能获取您 90 天内的寻访历史。若您超过 90 天未更新记录，则中途的记录与实际情况可能存在一定偏差。')}
          </p>
          <p>
            <span className="font-medium text-fg-0">3. </span>
            {t('legal.terms.basic3', '本软件涉及的角色形象、账号数据等内容所有权均归鹰角网络所有。')}
          </p>
        </div>
      </section>

      {/* 云同步服务条款 */}
      <section>
        <h3 className="text-base font-semibold text-fg-0 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          {t('legal.terms.cloudTitle', '云同步服务相关')}
        </h3>
        <div className="space-y-3 pl-3.5 border-l-2 border-border">
          <p>
            <span className="font-medium text-fg-0">1. </span>
            {t('legal.terms.cloud1', '您理解并同意，若发生不可抗力因素（如自然灾害、网络故障、服务器故障等）导致的服务中断、数据丢失等情况，我们不承担任何责任。')}
          </p>
          <p>
            <span className="font-medium text-fg-0">2. </span>
            {t('legal.terms.cloud2', '上传至云端同步的数据不包含您的鹰角通行证 Token 数据，仅包含在您设备本地分析的抽卡记录。')}
          </p>
          <p>
            <span className="font-medium text-fg-0">3. </span>
            {t('legal.terms.cloud3', '若本服务即将终止，我们会在服务终止前 30 日内向您提供终止通知。届时请自行下载并备份数据，逾期造成的数据损失应由您自行承担。')}
          </p>
        </div>
      </section>
    </div>
  );
}

/** 隐私政策内容 */
function PrivacyContent() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-fg-1 leading-relaxed">
      <section>
        <h3 className="text-base font-semibold text-fg-0 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          {t('legal.privacy.dataCollectionTitle', '数据收集与存储')}
        </h3>
        <div className="space-y-3 pl-3.5 border-l-2 border-border">
          <p>
            <span className="font-medium text-fg-0">1. </span>
            {t('legal.privacy.dataCollection1', '当您在本软件内登录鹰角账号后，将在您的设备本地读取寻访历史记录，并在本地进行统计和展示。若开启云同步服务，数据将上传至服务器进行保存。')}
          </p>
          <p>
            <span className="font-medium text-fg-0">2. </span>
            {t('legal.privacy.dataCollection2', '在您成功获取寻访记录后，您的登录状态（用于获取寻访链接）将保存于设备本地，以实现后续免登录增量更新。若您需要删除相关数据，可在「账号管理」-「已添加账号」内删除账号。')}
          </p>
          <p>
            <span className="font-medium text-fg-0">3. </span>
            {t('legal.privacy.dataCollection3', '您的寻访历史数据将持续保存于本软件本地数据中，每次同步记录时采取增量方式进行刷新。若您需要删除数据，请在「设置」-「危险操作」内删除当前选中账号数据。')}
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-fg-0 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          {t('legal.privacy.dataProtectionTitle', '数据保护')}
        </h3>
        <div className="space-y-3 pl-3.5 border-l-2 border-border">
          <p>
            <span className="font-medium text-fg-0">4. </span>
            {t('legal.privacy.dataProtection1', '您上传至云同步服务器的数据，未经您的许可我们不会向第三方提供或披露，但以下情况除外：')}
          </p>
          <ul className="pl-6 space-y-1 text-fg-2">
            <li className="list-disc">{t('legal.privacy.exception1', '根据法律法规的规定或有权机关的要求')}</li>
            <li className="list-disc">{t('legal.privacy.exception2', '为维护本软件的合法权益')}</li>
            <li className="list-disc">{t('legal.privacy.exception3', '经您本人明确授权同意')}</li>
          </ul>
        </div>
      </section>

      {/* 联系方式 */}
      <div className="mt-6 p-4 rounded-xl bg-bg-2 border border-border">
        <p className="text-xs text-fg-2">
          {t('legal.privacy.contact', '如您对本隐私政策有任何疑问，可通过软件内的反馈渠道与我们联系。')}
        </p>
      </div>
    </div>
  );
}

export default LegalModal;
