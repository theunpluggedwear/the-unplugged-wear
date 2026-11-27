export type SaveAction = 'create' | 'update' | 'bulk-status' | 'bulk-delete';

export type AsyncState =
  | { kind: 'idle' }
  | { kind: 'busy'; action: SaveAction };

export type AsyncEvent =
  | { type: 'START'; action: SaveAction }
  | { type: 'FINISH' };

export const initialAsyncState: AsyncState = { kind: 'idle' };

export function asyncReducer(state: AsyncState, event: AsyncEvent): AsyncState {
  switch (event.type) {
    case 'START':
      return { kind: 'busy', action: event.action };
    case 'FINISH':
      return { kind: 'idle' };
    default:
      return state;
  }
}

export function isAsyncBusy(state: AsyncState): boolean {
  return state.kind === 'busy';
}
