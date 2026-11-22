'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
  fullWidth?: boolean;
}

export default function Select({
  label,
  helperText,
  error,
  options = [],
  children,
  fullWidth = true,
  className = '',
  style = {},
  disabled,
  onFocus,
  onBlur,
  ...props
}: SelectProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {label && (
        <label
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--tuw-text-primary, #262626)',
            fontFamily: 'var(--font-urbanist, Urbanist), sans-serif',
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative', width: '100%' }}>
        <select
          disabled={disabled}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={{
            width: '100%',
            height: '42px',
            padding: '0 36px 0 14px',
            borderRadius: 'var(--tuw-radius-control, 8px)',
            border: `1px solid ${
              error
                ? 'var(--tuw-text-error, #C91818)'
                : focused
                ? 'var(--tuw-action-primary, #7539FF)'
                : 'var(--tuw-border-control, #D1D5DB)'
            }`,
            boxShadow: error
              ? '0 0 0 3px rgba(201, 24, 24, 0.12)'
              : focused
              ? '0 0 0 3px rgba(117, 57, 255, 0.12)'
              : 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            backgroundColor: disabled ? 'var(--tuw-bg-canvas, #F7F8F9)' : 'var(--tuw-bg-surface, #FFFFFF)',
            color: 'var(--tuw-text-primary, #262626)',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            appearance: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxSizing: 'border-box',
            ...style,
          }}
          className={className}
          {...props}
        >
          {options.length > 0
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <span
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--tuw-text-secondary, #5D6772)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronDown size={16} />
        </span>
      </div>

      {error ? (
        <span style={{ fontSize: '12px', color: 'var(--tuw-text-error, #C91818)' }}>
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '12px', color: 'var(--tuw-text-secondary, #5D6772)' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
