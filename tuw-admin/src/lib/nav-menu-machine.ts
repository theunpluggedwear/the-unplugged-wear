export type NavMenuSource = 'hover' | 'click';

export type NavMenuState =
  | { kind: 'closed'; suppressed: string | null }
  | { kind: 'open'; key: string; source: NavMenuSource; pendingClose: boolean; suppressed: string | null }
  | { kind: 'closing'; key: string };

export type NavMenuEvent =
  | { type: 'ENTER_GROUP'; key: string }
  | { type: 'CLICK_TRIGGER'; key: string }
  | { type: 'POINTER_LEAVE' }
  | { type: 'CLOSE_REQUEST' }
  | { type: 'FINALIZE' }
  | { type: 'CANCEL_CLOSE' }
  | { type: 'ESCAPE' }
  | { type: 'NAVIGATE' };

export const initialNavMenu: NavMenuState = { kind: 'closed', suppressed: null };

export function navMenuReducer(state: NavMenuState, event: NavMenuEvent): NavMenuState {
  switch (event.type) {
    case 'ENTER_GROUP':
      if (state.kind === 'closed') {
        if (state.suppressed === 'all' || state.suppressed === event.key) return state;
        return { kind: 'open', key: event.key, source: 'hover', pendingClose: false, suppressed: null };
      }
      if (state.kind === 'open') {
        if (state.suppressed === 'all' || state.suppressed === event.key) return state;
        return { ...state, key: event.key, source: 'hover', pendingClose: false, suppressed: null };
      }
      return { kind: 'open', key: event.key, source: 'hover', pendingClose: false, suppressed: null };

    case 'CLICK_TRIGGER':
      if (state.kind === 'open' && state.key === event.key) {
        return { kind: 'closed', suppressed: event.key };
      }
      return { kind: 'open', key: event.key, source: 'click', pendingClose: false, suppressed: null };

    case 'POINTER_LEAVE':
      if (state.kind !== 'open') return state;
      return { ...state, pendingClose: true, suppressed: null };

    case 'CANCEL_CLOSE':
      return state.kind === 'open' ? { ...state, pendingClose: false } : state;

    case 'CLOSE_REQUEST':
      return state.kind === 'open' ? { kind: 'closing', key: state.key } : state;

    case 'FINALIZE':
      return state.kind === 'closing' ? { kind: 'closed', suppressed: null } : state;

    case 'ESCAPE':
    case 'NAVIGATE':
      return state.kind === 'closed' ? state : { kind: 'closed', suppressed: 'all' };
  }
}
