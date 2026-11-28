import type { TooltipPosition } from './tooltipPosition';

export type TooltipReason = 'hover' | 'focus' | 'pin';

export type TooltipState =
  | { kind: 'hidden' }
  | { kind: 'scheduled' }
  | { kind: 'visible'; reason: TooltipReason; placement: TooltipPosition | null };

export type TooltipEvent =
  | { type: 'SCHEDULE' }
  | { type: 'OPEN'; reason: TooltipReason }
  | { type: 'CLICK' }
  | { type: 'HIDE' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'BLUR' }
  | { type: 'PLACE'; placement: TooltipPosition };

export const initialTooltip: TooltipState = { kind: 'hidden' };

export function tooltipReducer(state: TooltipState, event: TooltipEvent): TooltipState {
  switch (event.type) {
    case 'SCHEDULE':
      return state.kind === 'hidden' ? { kind: 'scheduled' } : state;
    case 'OPEN':
      return { kind: 'visible', reason: event.reason, placement: state.kind === 'visible' ? state.placement : null };
    case 'CLICK':
      if (state.kind === 'visible' && state.reason === 'pin') return { kind: 'hidden' };
      return { kind: 'visible', reason: 'pin', placement: state.kind === 'visible' ? state.placement : null };
    case 'HIDE':
      return { kind: 'hidden' };
    case 'POINTER_LEAVE':
      if (state.kind === 'scheduled') return { kind: 'hidden' };
      return state.kind === 'visible' && state.reason === 'hover' ? { kind: 'hidden' } : state;
    case 'BLUR':
      return state.kind === 'visible' && state.reason === 'focus' ? { kind: 'hidden' } : state;
    case 'PLACE':
      return state.kind === 'visible' ? { ...state, placement: event.placement } : state;
  }
}
