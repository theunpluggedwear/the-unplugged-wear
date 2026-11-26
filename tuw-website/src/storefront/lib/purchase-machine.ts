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
    case 'ADD': return { kind: 'added' };
    case 'BUY': return { kind: 'buying' };
    case 'FAIL': return { kind: 'error', message: event.message };
    case 'RESET': return { kind: 'idle' };
  }
}
