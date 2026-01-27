/**
 * 工业科幻风格按钮组件
 * 基于设计系统圆角规范（Design Tokens）
 * 
 * 圆角: rounded-md (8px) - 与卡片 (12px) 形成层次
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
    bg-brand/12 text-fg-0
    hover:bg-brand/18
    active:bg-brand/22
    border border-brand/35
    shadow-sm shadow-brand/10
    hover:shadow-md hover:shadow-brand/20
    active:shadow-sm
    after:ring-brand/25 hover:after:ring-brand/40
  `,
  secondary: `
    bg-bg-2 text-fg-0 
    hover:bg-bg-3
    active:bg-bg-2
    border border-border
    hover:border-brand/25
    shadow-sm shadow-black/5 dark:shadow-black/20
    hover:shadow-md hover:shadow-black/10 dark:hover:shadow-black/30
    after:ring-fg-2/10 hover:after:ring-brand/25
  `,
  accent: `
    bg-brand text-accent-btn-text font-semibold
    hover:bg-brand-hover 
    active:bg-brand-active
    border border-brand/35
    border-l-4 border-l-yellow-600
    shadow-md shadow-brand/25
    hover:shadow-lg hover:shadow-brand/35
    active:shadow-md
    after:ring-white/10 hover:after:ring-white/20
  `,
  ghost: `
    bg-transparent text-fg-1
    hover:bg-bg-2
    active:bg-bg-3
    after:ring-fg-2/0 hover:after:ring-fg-2/10
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
        group relative inline-flex items-center justify-center
        rounded-md
        font-medium
        outline-none
        transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out
        motion-reduce:transition-none
        hover:-translate-y-[1px]
        active:translate-y-0 active:scale-[0.99]
        disabled:hover:translate-y-0 disabled:active:scale-100
        focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0
        disabled:opacity-50 disabled:cursor-not-allowed
        before:content-[''] before:absolute before:inset-0 before:rounded-md before:pointer-events-none
        before:bg-gradient-to-b before:from-white/18 before:to-transparent
        before:opacity-0 hover:before:opacity-100
        before:transition-opacity before:duration-200
        motion-reduce:before:transition-none
        after:content-[''] after:absolute after:inset-0 after:rounded-md after:pointer-events-none
        after:ring-1 after:ring-transparent after:transition-[box-shadow] after:duration-200
        motion-reduce:after:transition-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {/* 斜纹装饰背景 */}
      <span
        className="absolute inset-0 opacity-[0.06] group-hover:opacity-[0.09] pointer-events-none rounded-md transition-opacity duration-200 motion-reduce:transition-none"
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
