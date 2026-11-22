'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import Tooltip from './Tooltip';
import type { TooltipSide } from '@/lib/tooltipPosition';

export interface InfoTooltipProps {
  
  label: string;
  
  content: string;
  
  position?: TooltipSide;
  
  size?: number;
}




export default function InfoTooltip({
  label,
  content,
  position = 'top',
  size = 14,
}: InfoTooltipProps) {
  const [active, setActive] = useState(false);

  return (
    <Tooltip content={content} position={position}>
      <button
        type="button"
        aria-label={label}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          padding: 0,
          border: 'none',
          borderRadius: 'var(--tuw-radius-pill, 9999px)',
          backgroundColor: 'transparent',
          color: active
            ? 'var(--tuw-action-primary, #7539FF)'
            : 'var(--tuw-text-secondary, #5D6772)',
          cursor: 'help',
          flexShrink: 0,
          transition: 'color 0.15s ease',
          outlineOffset: 2,
        }}
      >
        <Info size={size} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
