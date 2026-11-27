export type PlacementState =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'awaiting_gateway'; orderNumber: string; receipt: string }
  | { kind: 'retryable'; message: string }
  | { kind: 'failed'; message: string }
  | { kind: 'placed' };

export type PlacementEvent =
  | { type: 'START' }
  | { type: 'GATEWAY'; orderNumber: string; receipt: string }
  | { type: 'RETRYABLE'; message: string }
  | { type: 'FAIL'; message: string }
  | { type: 'PLACED' }
  | { type: 'RESET' };

export const initialPlacement: PlacementState = { kind: 'idle' };

export function placementReducer(state: PlacementState, event: PlacementEvent): PlacementState {
  switch (event.type) {
    case 'START':
      return state.kind === 'creating' || state.kind === 'awaiting_gateway' || state.kind === 'placed'
        ? state
        : { kind: 'creating' };
    case 'GATEWAY':
      return state.kind === 'creating' ? { kind: 'awaiting_gateway', orderNumber: event.orderNumber, receipt: event.receipt } : state;
    case 'RETRYABLE':
      return state.kind === 'creating' || state.kind === 'awaiting_gateway'
        ? { kind: 'retryable', message: event.message }
        : state;
    case 'FAIL':
      return state.kind === 'creating' || state.kind === 'awaiting_gateway'
        ? { kind: 'failed', message: event.message }
        : state;
    case 'PLACED':
      return state.kind === 'creating' ? { kind: 'placed' } : state;
    case 'RESET':
      return state.kind === 'placed' ? state : { kind: 'idle' };
  }
}
