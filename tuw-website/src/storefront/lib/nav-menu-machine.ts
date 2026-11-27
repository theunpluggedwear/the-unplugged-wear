export type NavMenuSource = 'hover' | 'click';

export type NavMenuState =
  | { kind: 'closed'; suppressed: string | null }
  | { kind: 'open'; key: string; source: NavMenuSource; pendingClose: boolean; suppressed: string | null }
  | { kind: 'closing'; key: string };

export type NavMenuEvent =
  | { type: 'ENTER_GROUP'; key: string }
  | { type: 'CLICK_TRIGGER'; key: string }
  | { type: 'POINTER_LEAVE' }
  | { type: 'CANCEL_CLOSE' }
  | { type: 'CLOSE_REQUEST' }
  | { type: 'FINALIZE' }
  | { type: 'ESCAPE' }
  | { type: 'NAVIGATE' }
  | { type: 'RESET_SUPPRESSION' };

export const initialNavMenu: NavMenuState = { kind: 'closed', suppressed: null };

export function navMenuReducer(state: NavMenuState, event: NavMenuEvent): NavMenuState {
  switch (event.type) {
    case 'ENTER_GROUP':
      if (state.kind === 'closing') {
        return { kind: 'open', key: event.key, source: 'hover', pendingClose: false, suppressed: null };
      }
      if (state.suppressed === 'all' || state.suppressed === event.key) return state;
      if (state.kind === 'closed') {
        return { kind: 'open', key: event.key, source: 'hover', pendingClose: false, suppressed: null };
      }
      return { ...state, key: event.key, source: 'hover', pendingClose: false, suppressed: null };
    case 'CLICK_TRIGGER':
      if (state.kind === 'open' && state.key === event.key) {
        return { kind: 'closed', suppressed: event.key };
      }
      return { kind: 'open', key: event.key, source: 'click', pendingClose: false, suppressed: null };
    case 'POINTER_LEAVE':
      return state.kind === 'open' ? { ...state, pendingClose: true } : state;
    case 'CANCEL_CLOSE':
      if (state.kind === 'closing') {
        return { kind: 'open', key: state.key, source: 'hover', pendingClose: false, suppressed: null };
      }
      return state.kind === 'open' ? { ...state, pendingClose: false } : state;
    case 'CLOSE_REQUEST':
      return state.kind === 'open' ? { kind: 'closing', key: state.key } : state;
    case 'FINALIZE':
      if (state.kind === 'closing') return { kind: 'closed', suppressed: null };
      return state.kind === 'open' && state.pendingClose ? { kind: 'closed', suppressed: null } : state;
    case 'ESCAPE':
    case 'NAVIGATE':
      return state.kind === 'closed' && state.suppressed === null ? state : { kind: 'closed', suppressed: null };
    case 'RESET_SUPPRESSION':
      if (state.kind === 'closed') {
        return state.suppressed === null ? state : { kind: 'closed', suppressed: null };
      }
      return state.kind === 'open' && state.suppressed !== null ? { ...state, suppressed: null } : state;
    default:
      return state;
  }
}
