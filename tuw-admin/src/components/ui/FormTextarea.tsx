'use client';

import React, { useId, useState } from 'react';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  
  label?: string;
  
  pad?: string;
  
  fontSize?: number;
  
  error?: string;
}




export default function FormTextarea({
  label,
  pad = '8px 12px',
  fontSize = 13,
  id,
  error,
  style = {},
  onFocus,
  onBlur,
  children,
  ...props
}: FormTextareaProps) {
  const generatedId = useId();
  const [focused, setFocused] = useState(false);
  const fieldId = id || generatedId;

  return (
    <div>
      {label ? (
        <label
          htmlFor={fieldId}
          style={{
            fontSize: 'var(--tuw-field-label-size, 13px)',
            fontWeight: 'var(--tuw-field-label-weight, 500)',
            color: 'var(--tuw-text-primary, #262626)',
            display: 'block',
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      ) : null}
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={{
          width: '100%',
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
          padding: pad,
          fontSize,
          fontFamily: 'inherit',
          backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
          color: 'var(--tuw-text-primary, #262626)',
          ...style,
        }}
        {...props}
      >
        {children}
      </textarea>
      {error ? (
        <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: '18px', color: 'var(--tuw-text-error, #C91818)', fontFamily: 'var(--font-main)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
