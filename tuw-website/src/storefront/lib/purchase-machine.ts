export type PurchaseState =
  | { kind: 'idle' }
  | { kind: 'added' }
  | { kind: 'buying' }
  | { kind: 'error'; message: string };

export type PurchaseEvent =
  | { type: 'ADD' }
  | { type: 'BUY' }
  | { type: 'FAIL'; message: string }
  | { type: 'RESET' };

export function purchaseReducer(state: PurchaseState, event: PurchaseEvent): PurchaseState {
  switch (event.type) {
    case 'ADD': return state.kind === 'buying' ? state : { kind: 'added' };
    case 'BUY': return state.kind === 'buying' ? state : { kind: 'buying' };
    case 'FAIL':
      return state.kind === 'buying' || state.kind === 'added'
        ? { kind: 'error', message: event.message }
        : state;
    case 'RESET':
      return state.kind === 'buying'
        ? { kind: 'error', message: 'Your bag could not be updated. Please try again.' }
        : { kind: 'idle' };
    default:
      return state;
  }
}
