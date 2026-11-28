'use client';

import React, { useState } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

export default function Textarea({
  label,
  helperText,
  error,
  fullWidth = true,
  className = '',
  style = {},
  disabled,
  onFocus,
  onBlur,
  ...props
}: TextareaProps) {
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

      <textarea
        disabled={disabled}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={{
          width: '100%',
          padding: '10px 14px',
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
          backgroundColor: disabled ? 'var(--tuw-bg-canvas, #F7F8F9)' : 'var(--tuw-bg-surface, #FFFFFF)',
          color: 'var(--tuw-text-primary, #262626)',
          fontSize: '14px',
          lineHeight: '20px',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
          resize: 'vertical',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...style,
        }}
        className={className}
        {...props}
      />

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
