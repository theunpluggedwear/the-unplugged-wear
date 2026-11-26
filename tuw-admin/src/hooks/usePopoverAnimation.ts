'use client';

import React from 'react';

export const POPOVER_EXIT_MS = 150;

type PopoverPhase = 'open' | 'closing' | 'closed';

interface PopoverState {
  phase: PopoverPhase;
}

type PopoverEvent = { type: 'OPEN' } | { type: 'CLOSE' } | { type: 'EXPIRE' };

export function popoverReducer(state: PopoverState, event: PopoverEvent): PopoverState {
  switch (event.type) {
    case 'OPEN': return { phase: 'open' };
    case 'CLOSE': return state.phase === 'closed' ? state : { phase: 'closing' };
    case 'EXPIRE': return { phase: 'closed' };
  }
}

interface PopoverAnimation {
  phase: PopoverPhase;
  visible: boolean;
  requestClose: () => void;
  cancelClose: () => void;
}

export function usePopoverAnimation(
  open: boolean,
  onClosed?: () => void,
  exitMs: number = POPOVER_EXIT_MS,
): PopoverAnimation {
  const [state, dispatch] = React.useReducer(popoverReducer, open ? { phase: 'open' } : { phase: 'closed' });
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpen = React.useRef(open);
  const openRef = React.useRef(open);
  const onClosedRef = React.useRef(onClosed);
  openRef.current = open;
  onClosedRef.current = onClosed;

  const clearTimer = React.useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const finishClose = React.useCallback(() => {
    clearTimer();
    dispatch({ type: 'EXPIRE' });
    onClosedRef.current?.();
  }, [clearTimer]);

  const startExit = React.useCallback(() => {
    clearTimer();
    if (!openRef.current) {
      finishClose();
      return;
    }
    const reduced = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dispatch({ type: 'CLOSE' });
    if (reduced) { finishClose(); return; }
    timer.current = setTimeout(finishClose, exitMs);
  }, [clearTimer, exitMs, finishClose]);

  React.useEffect(() => {
    clearTimer();
    if (open) {
      wasOpen.current = true;
      dispatch({ type: 'OPEN' });
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    startExit();
  }, [open, clearTimer, startExit]);

  React.useEffect(() => clearTimer, [clearTimer]);

  return {
    phase: state.phase,
    visible: state.phase !== 'closed',
    requestClose: startExit,
    cancelClose: () => {
      if (!openRef.current) return;
      clearTimer();
      dispatch({ type: 'OPEN' });
    },
  };
}
