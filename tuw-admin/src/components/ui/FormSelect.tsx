'use client';

import React, { useId, useState } from 'react';
import InfoTooltip from './InfoTooltip';

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  
  label?: string;
  
  labelTooltip?: string;
  
  helperText?: React.ReactNode;
  
  fontSize?: number;
  
  padX?: number;
  
  error?: string;
}







export default function FormSelect({
  label,
  labelTooltip,
  helperText,
  fontSize = 13,
  padX = 10,
  style = {},
  id,
  required,
  error,
  'aria-describedby': ariaDescribedBy,
  onFocus,
  onBlur,
  children,
  ...props
}: FormSelectProps) {
  const generatedId = useId();
  const [focused, setFocused] = useState(false);
  const selectId = id ?? generatedId;
  const helperId = helperText ? `${selectId}-help` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [ariaDescribedBy, helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      {label ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            minWidth: 0,
            minHeight: 'var(--tuw-field-label-row-height, 0px)',
          }}
        >
          <label
            htmlFor={selectId}
            style={{
              fontSize: 'var(--tuw-field-label-size, 13px)',
              fontWeight: 'var(--tuw-field-label-weight, 500)',
              color: 'var(--tuw-text-primary, #262626)',
              fontFamily: 'var(--font-main)',
            }}
          >
            {label}
            {required ? (
              <span
                aria-hidden="true"
                style={{
                  marginLeft: 4,
                  color: 'var(--tuw-text-secondary, #5D6772)',
                  fontWeight: 'var(--tuw-field-label-weight, 500)',
                }}
              >
                *
              </span>
            ) : null}
          </label>
          {labelTooltip ? (
            <InfoTooltip
              label={`More information about ${label}`}
              content={labelTooltip}
            />
          ) : null}
        </div>
      ) : null}
      <select
        id={selectId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        required={required}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={{
          width: '100%',
          height: 40,
          borderRadius: 8,
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
          padding: `0 ${padX}px`,
          fontSize,
          fontFamily: 'var(--font-main)',
          backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
          color: 'var(--tuw-text-primary, #262626)',
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p
          id={errorId}
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--tuw-text-error, #C91818)',
            fontFamily: 'var(--font-main)',
          }}
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          id={helperId}
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--tuw-text-secondary, #5D6772)',
            fontFamily: 'var(--font-main)',
          }}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
