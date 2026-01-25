/**
 * 输入框组件
 * 基于设计系统圆角规范（Design Tokens）
 * 
 * 圆角: rounded-md (8px) - 与按钮保持一致
 */

import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-fg-1 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-2">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-md border bg-bg-2 px-4 py-2.5
              text-fg-0 placeholder:text-fg-2/60
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand
              disabled:opacity-50 disabled:cursor-not-allowed
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-red-500 focus:ring-red-500/50' : 'border-border'}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-fg-2">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
