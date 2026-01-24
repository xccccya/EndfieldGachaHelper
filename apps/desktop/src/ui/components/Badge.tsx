/**
 * 徽章组件
 */

import type { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'brand'
  | 'version'
  | 'success'
  | 'warning'
  | 'error'
  | 'rarity6'
  | 'rarity5'
  | 'rarity4'
  | 'rarity3';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bg-3 text-fg-0 border-border',
  brand: 'bg-brand text-black border-brand',
  version:
    'bg-gradient-to-r from-brand/15 to-purple-500/15 text-fg-0 border-brand/25 px-2.5 py-1 rounded-full font-mono text-[11px] tracking-wide shadow-sm',
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  // 稀有度颜色
  rarity6: 'bg-red-500/20 text-red-400 border-red-500/50',
  rarity5: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  rarity4: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  rarity3: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
};

export function Badge({ variant = 'default', children, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-xs font-semibold rounded
        border
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: number }) {
  const variant = rarity === 6 ? 'rarity6' 
    : rarity === 5 ? 'rarity5' 
    : rarity === 4 ? 'rarity4' 
    : 'rarity3';
  
  return (
    <Badge variant={variant}>
      {rarity}星
    </Badge>
  );
}

export default Badge;
