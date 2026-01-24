/**
 * 工业科幻风格按钮组件
 * 基于 Design.md 设计规范
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    bg-bg-3 text-fg-0 
    hover:bg-fg-2/20 
    active:bg-bg-2
    border-l-4 border-brand
  `,
  secondary: `
    bg-bg-2 text-fg-0 
    hover:bg-bg-3
    active:bg-bg-2
    border border-border
  `,
  accent: `
    bg-brand text-black font-semibold
    hover:bg-brand-hover 
    active:bg-brand-active
    border-l-4 border-yellow-600
  `,
  ghost: `
    bg-transparent text-fg-1
    hover:bg-bg-2
    active:bg-bg-3
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-base gap-2',
  lg: 'px-6 py-3.5 text-lg gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    children,
    className = '',
    disabled,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      className={`
        relative inline-flex items-center justify-center
        rounded transition-all duration-200 ease-out
        font-medium
        focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-2 focus:ring-offset-bg-0
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {/* 斜纹装饰背景 */}
      <span
        className="absolute inset-0 opacity-[0.06] pointer-events-none rounded"
        style={{
          backgroundImage: `linear-gradient(
            -45deg,
            transparent 0%,
            transparent 40%,
            currentColor 40%,
            currentColor 50%,
            transparent 50%,
            transparent 90%,
            currentColor 90%,
            currentColor 100%
          )`,
          backgroundSize: '6px 6px',
        }}
      />

      {loading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}

      {children && <span className="relative">{children}</span>}
    </button>
  );
});

export default Button;
