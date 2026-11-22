'use client';

import React, { useId } from 'react';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  
  label?: string;
  
  pad?: string;
  
  fontSize?: number;
}




export default function FormTextarea({
  label,
  pad = '8px 12px',
  fontSize = 13,
  id,
  style = {},
  children,
  ...props
}: FormTextareaProps) {
  const generatedId = useId();
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
        style={{
          width: '100%',
          borderRadius: 8,
          border: '1px solid var(--tuw-border-control, #D1D5DB)',
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
    </div>
  );
}
