/**
 * 同步认证弹窗组件
 * 登录/注册/找回密码一体化弹窗，带动画切换
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, Check, Cloud, X, Square, CheckSquare } from 'lucide-react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { LegalModal } from './LegalModal';
import { useSyncAuth } from '../../hooks/useSync';

type AuthMode = 'login' | 'register' | 'reset';

type SyncAuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: AuthMode;
};

export function SyncAuthModal({ open, onOpenChange, initialMode = 'login' }: SyncAuthModalProps) {
  const { t } = useTranslation();
  const { loading, error, clearError, sendCode, register, login, resetPassword } = useSyncAuth();
  
  // 当前模式
  const [mode, setMode] = useState<AuthMode>(initialMode);
  
  // 表单状态
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // 验证码发送状态
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  
  // 动画状态
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 协议同意状态
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');
  
  // 重置所有状态
  const resetState = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setShowPassword(false);
    setCodeSent(false);
    setCountdown(0);
    setAgreedToTerms(false);
    clearError();
  }, [clearError]);
  
  // 切换模式时的动画
  const switchMode = useCallback((newMode: AuthMode) => {
    if (mode === newMode || isAnimating) return;
    
    setIsAnimating(true);
    clearError();
    
    // 先淡出
    if (contentRef.current) {
      contentRef.current.style.opacity = '0';
      contentRef.current.style.transform = 'translateX(-8px)';
    }
    
    setTimeout(() => {
      setMode(newMode);
      // 只清除特定字段
      setCode('');
      setCodeSent(false);
      if (newMode === 'login') {
        setConfirmPassword('');
      }
      
      // 淡入
      if (contentRef.current) {
        contentRef.current.style.opacity = '1';
        contentRef.current.style.transform = 'translateX(0)';
      }
      
      setTimeout(() => setIsAnimating(false), 200);
    }, 150);
  }, [mode, isAnimating, clearError]);
  
  // 打开弹窗时重置
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      resetState();
    }
  }, [open, initialMode, resetState]);
  
  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!email || sendingCode || countdown > 0) return;
    
    // 简单的邮箱格式验证
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return;
    }
    
    setSendingCode(true);
    const success = await sendCode(email, mode === 'register' ? 'register' : 'reset');
    setSendingCode(false);
    
    if (success) {
      setCodeSent(true);
      setCountdown(60);
    }
  }, [email, sendingCode, countdown, sendCode, mode]);
  
  // 提交表单
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    let success = false;
    
    if (mode === 'login') {
      success = await login(email, password);
    } else if (mode === 'register') {
      if (password !== confirmPassword) {
        return;
      }
      success = await register(email, password, code);
    } else if (mode === 'reset') {
      if (password !== confirmPassword) {
        return;
      }
      success = await resetPassword(email, code, password);
      if (success) {
        // 重置成功后切换到登录
        switchMode('login');
        return;
      }
    }
    
    if (success) {
      onOpenChange(false);
    }
  }, [mode, email, password, confirmPassword, code, loading, login, register, resetPassword, switchMode, onOpenChange]);
  
  // 表单验证
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 8;
  const isConfirmValid = mode === 'login' || password === confirmPassword;
  const isCodeValid = mode === 'login' || code.length === 6;
  const isTermsValid = agreedToTerms; // 所有模式都需要勾选协议
  const canSubmit = isEmailValid && isPasswordValid && isConfirmValid && isCodeValid && isTermsValid;
  
  // 打开协议弹窗
  const openLegalModal = useCallback((tab: 'terms' | 'privacy') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  }, []);
  
  // 模式标题
  const modeTitle = {
    login: t('syncAuth.loginTitle', '登录同步账号'),
    register: t('syncAuth.registerTitle', '注册同步账号'),
    reset: t('syncAuth.resetTitle', '重置密码'),
  };
  
  const modeDesc = {
    login: t('syncAuth.loginDesc', '登录后可将抽卡记录同步到云端'),
    register: t('syncAuth.registerDesc', '创建账号以启用云同步功能'),
    reset: t('syncAuth.resetDesc', '通过邮箱验证码重置密码'),
  };
  
  return (
    <>
    <LegalModal 
      open={legalModalOpen} 
      onOpenChange={setLegalModalOpen} 
      initialTab={legalModalTab} 
    />
    <Modal open={open} onOpenChange={onOpenChange} maxWidthClassName="max-w-md" backdrop="light">
      <div className="p-6 bg-bg-1">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
            <Cloud className="w-6 h-6 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-fg-0">{modeTitle[mode]}</h2>
            <p className="text-sm text-fg-1">{modeDesc[mode]}</p>
          </div>
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-2 hover:text-fg-0 hover:bg-bg-2 transition-colors"
            aria-label={t('common.dismiss', '关闭')}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* 内容区域（带动画） */}
        <div
          ref={contentRef}
          className="transition-all duration-200 ease-out"
          style={{ opacity: 1, transform: 'translateX(0)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 */}
            <Input
              type="email"
              label={t('syncAuth.email', '邮箱')}
              placeholder={t('syncAuth.emailPlaceholder', '请输入邮箱地址')}
              icon={<Mail size={18} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={email && !isEmailValid ? t('syncAuth.emailInvalid', '邮箱格式不正确') : undefined}
              disabled={loading}
            />
            
            {/* 验证码（注册/重置） */}
            {mode !== 'login' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-fg-1">
                  {t('syncAuth.code', '验证码')}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t('syncAuth.codePlaceholder', '6位验证码')}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    className="flex-1"
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSendCode}
                    disabled={!isEmailValid || sendingCode || countdown > 0}
                    className="shrink-0 min-w-[100px]"
                  >
                    {sendingCode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : countdown > 0 ? (
                      `${countdown}s`
                    ) : codeSent ? (
                      t('syncAuth.resend', '重新发送')
                    ) : (
                      t('syncAuth.sendCode', '发送验证码')
                    )}
                  </Button>
                </div>
                {codeSent && (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <Check size={12} />
                    {t('syncAuth.codeSent', '验证码已发送到您的邮箱')}
                  </p>
                )}
              </div>
            )}
            
            {/* 密码 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-fg-1">
                {mode === 'reset' ? t('syncAuth.newPassword', '新密码') : t('syncAuth.password', '密码')}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('syncAuth.passwordPlaceholder', '至少8位密码')}
                  icon={<Lock size={18} />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  error={password && !isPasswordValid ? t('syncAuth.passwordTooShort', '密码至少需要8位') : undefined}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 hover:text-fg-1 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            {/* 确认密码（注册/重置） */}
            {mode !== 'login' && (
              <Input
                type={showPassword ? 'text' : 'password'}
                label={t('syncAuth.confirmPassword', '确认密码')}
                placeholder={t('syncAuth.confirmPasswordPlaceholder', '再次输入密码')}
                icon={<Lock size={18} />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                error={confirmPassword && !isConfirmValid ? t('syncAuth.passwordMismatch', '两次输入的密码不一致') : undefined}
              />
            )}
            
            {/* 用户协议同意 */}
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => setAgreedToTerms(!agreedToTerms)}
                className={`mt-0.5 shrink-0 transition-colors ${agreedToTerms ? 'text-brand' : 'text-fg-2 hover:text-fg-1'}`}
                aria-label={agreedToTerms ? t('syncAuth.agreed', '已同意') : t('syncAuth.notAgreed', '未同意')}
              >
                {agreedToTerms ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
              <span className="text-sm text-fg-2 leading-relaxed">
                {t('syncAuth.agreePrefix', '我已阅读并同意')}
                <button
                  type="button"
                  onClick={() => openLegalModal('terms')}
                  className="text-brand hover:text-brand-hover transition-colors mx-0.5"
                >
                  {t('legal.termsLink', '《用户协议》')}
                </button>
                {t('syncAuth.agreeAnd', '和')}
                <button
                  type="button"
                  onClick={() => openLegalModal('privacy')}
                  className="text-brand hover:text-brand-hover transition-colors mx-0.5"
                >
                  {t('legal.privacyLink', '《隐私政策》')}
                </button>
              </span>
            </div>
            
            {/* 错误提示 */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                {error}
              </div>
            )}
            
            {/* 提交按钮 */}
            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              disabled={!canSubmit || loading}
              loading={loading}
            >
              {mode === 'login' && t('syncAuth.login', '登录')}
              {mode === 'register' && t('syncAuth.register', '注册')}
              {mode === 'reset' && t('syncAuth.resetPassword', '重置密码')}
            </Button>
          </form>
          
          {/* 底部切换链接 */}
          <div className="mt-6 pt-4 border-t border-border">
            {mode === 'login' && (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-brand hover:text-brand-hover transition-colors"
                  disabled={isAnimating}
                >
                  {t('syncAuth.goRegister', '没有账号？立即注册')}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-fg-1 hover:text-fg-0 transition-colors"
                  disabled={isAnimating}
                >
                  {t('syncAuth.forgotPassword', '忘记密码？')}
                </button>
              </div>
            )}
            
            {mode === 'register' && (
              <div className="flex items-center justify-center text-sm">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-brand hover:text-brand-hover transition-colors flex items-center gap-1"
                  disabled={isAnimating}
                >
                  <ArrowLeft size={14} />
                  {t('syncAuth.goLogin', '已有账号？返回登录')}
                </button>
              </div>
            )}
            
            {mode === 'reset' && (
              <div className="flex items-center justify-center text-sm">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-brand hover:text-brand-hover transition-colors flex items-center gap-1"
                  disabled={isAnimating}
                >
                  <ArrowLeft size={14} />
                  {t('syncAuth.backToLogin', '返回登录')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
}

export default SyncAuthModal;
