/**
 * 卡片组件
 * 基于 Design.md 设计规范
 */

import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  hover?: boolean;
};

export function Card({ children, hover = false, className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        relative rounded-2xl border border-border bg-bg-1 shadow-lg
        ${hover ? 'transition-transform duration-200 hover:scale-[1.02] hover:shadow-xl' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  accent?: boolean;
  /** 是否隐藏底部边框（用于只有 Header 没有 Content 的卡片） */
  noBorder?: boolean;
};

export function CardHeader({ children, accent = false, noBorder = false, className = '', ...props }: CardHeaderProps) {
  return (
    <div
      className={`
        px-5 py-4
        ${noBorder ? '' : 'border-b border-border'}
        ${accent ? 'bg-bg-3 text-fg-0' : ''}
        ${className}
      `}
      style={accent ? {
        backgroundImage: `linear-gradient(
          -45deg,
          transparent 0%,
          transparent 40%,
          var(--stripe-color) 40%,
          var(--stripe-color) 50%,
          transparent 50%,
          transparent 90%,
          var(--stripe-color) 90%,
          var(--stripe-color) 100%
        )`,
        backgroundSize: '8px 8px',
      } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 border-t border-border bg-bg-2/50 ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;
