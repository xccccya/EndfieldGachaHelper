/**
 * 武器头像组件
 * 用于显示武器图标（6★/5★），支持UP标记、空状态占位等
 */

import { useState } from 'react';
import { X } from 'lucide-react';

export type WeaponAvatarProps = {
  /** 武器ID（对应 public/wpnimg/<id>.png） */
  weaponId?: string | undefined;
  /** 稀有度（用于边框/高亮样式） */
  rarity?: number | undefined;
  /** 头像尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否为UP武器（仅样式提示） */
  isUp?: boolean | undefined;
  /** 是否显示"歪"标签（非UP的6星） */
  showOffBanner?: boolean | undefined;
  /** 是否为空状态（显示问号或叉号） */
  isEmpty?: boolean | undefined;
  /** 空状态类型 */
  emptyType?: 'unknown' | 'failed';
  /** 自定义类名 */
  className?: string | undefined;
};

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const iconSizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
};

export function WeaponAvatar({
  weaponId,
  rarity = 6,
  size = 'md',
  isUp = false,
  showOffBanner = false,
  isEmpty = false,
  emptyType = 'unknown',
  className = '',
}: WeaponAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const sizeClass = sizeMap[size];
  const iconSize = iconSizeMap[size];

  if (isEmpty || !weaponId || imgError) {
    return (
      <div className={`relative ${sizeClass} ${className}`}>
        <div
          className={`w-full h-full rounded-full border-2 ${
            emptyType === 'failed' ? 'border-red-400/50' : 'border-border'
          } bg-bg-3 flex items-center justify-center`}
        >
          {emptyType === 'unknown' ? (
            <span
              className="text-fg-2 font-bold"
              style={{ fontSize: size === 'sm' ? '16px' : size === 'md' ? '20px' : '24px' }}
            >
              ?
            </span>
          ) : (
            <X size={iconSize} className="text-red-400" />
          )}
        </div>
      </div>
    );
  }

  const imagePath = `/wpnimg/${weaponId}.png`;

  const borderClass = (() => {
    if (isUp) return 'border-orange-500 shadow-lg shadow-orange-500/30';
    if (rarity === 6) return 'border-orange-400/60';
    if (rarity === 5) return 'border-amber-400/60';
    if (rarity === 4) return 'border-purple-400/55';
    if (rarity === 3) return 'border-blue-400/55';
    return 'border-border';
  })();

  return (
    <div className={`relative ${sizeClass} ${className}`}>
      <div className={`w-full h-full rounded-full border-2 ${borderClass} overflow-hidden bg-bg-3 relative`}>
        {!imgLoaded && <div className="absolute inset-0 bg-bg-3 animate-pulse" />}
        <img
          src={imagePath}
          alt=""
          className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      </div>

      {/* "歪"标签 */}
      {showOffBanner && !isUp && (
        <div 
          className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold px-1 py-0.5 rounded shadow-md"
          style={{ fontSize: size === 'sm' ? '8px' : '10px' }}
        >
          歪
        </div>
      )}

      {isUp && (
        <div className="absolute -inset-0.5 rounded-full border-2 border-orange-400 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

