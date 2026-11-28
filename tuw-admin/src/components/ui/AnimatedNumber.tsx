'use client';

import React from 'react';

export interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
  
  upClassName?: string;
  
  downClassName?: string;
  
  minDurationMs?: number;
  
  maxDurationMs?: number;
  
  fullScaleAt?: number;
}






export default function AnimatedNumber({
  value,
  format,
  className = '',
  style = {},
  upClassName = '',
  downClassName = '',
  minDurationMs = 1000,
  maxDurationMs = 1500,
  fullScaleAt = 0.5,
}: AnimatedNumberProps) {
  const [display, setDisplay] = React.useState(value);
  const [tint, setTint] = React.useState<0 | 1 | -1>(0);
  const displayRef = React.useRef(value);
  const raf = React.useRef<number | null>(null);
  const linger = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      if (linger.current !== null) {
        clearTimeout(linger.current);
        linger.current = null;
      }
    },
    [],
  );

  React.useEffect(() => {
    const from = displayRef.current;
    if (from === value) return;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (linger.current !== null) {
      clearTimeout(linger.current);
      linger.current = null;
    }
    const span = maxDurationMs - minDurationMs;
    const relative = Math.abs(value - from) / Math.max(Math.abs(from), 1);
    const duration = minDurationMs + span * Math.min(1, relative / fullScaleAt);
    setTint(value > from ? 1 : -1);
    const startedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      
      const eased =
        progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const current = Math.round(from + (value - from) * eased);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = null;
        
        
        linger.current = setTimeout(() => {
          linger.current = null;
          setTint(0);
        }, 150);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };
  }, [value, minDurationMs, maxDurationMs, fullScaleAt]);

  const toneClass = tint === 1 ? upClassName : tint === -1 ? downClassName : '';
  return (
    <span className={`${className} ${toneClass}`.trim().replace(/\s+/g, ' ')} style={style}>
      {format(display)}
    </span>
  );
}
