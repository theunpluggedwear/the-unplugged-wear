export type SaveAction = 'create' | 'update' | 'bulk-status' | 'bulk-delete';

export type AsyncState =
  | { kind: 'idle'; pending: readonly number[] }
  | { kind: 'busy'; action: SaveAction; pending: readonly number[] };

export type AsyncEvent =
  | { type: 'START'; action: SaveAction; id?: number }
  | { type: 'FINISH'; id?: number };

export const initialAsyncState: AsyncState = { kind: 'idle', pending: [] };

export function asyncReducer(state: AsyncState, event: AsyncEvent): AsyncState {
  switch (event.type) {
    case 'START': {
      const id = event.id ?? (state.pending.length === 0 ? 0 : Math.max(...state.pending) + 1);
      return { kind: 'busy', action: event.action, pending: [...state.pending.filter((value) => value !== id), id] };
    }
    case 'FINISH': {
      const pending = event.id === undefined ? [] : state.pending.filter((value) => value !== event.id);
      if (pending.length === 0) return { kind: 'idle', pending };
      return { kind: 'busy', action: state.kind === 'busy' ? state.action : 'update', pending };
    }
    default:
      return state;
  }
}

export function isAsyncBusy(state: AsyncState): boolean {
  return state.kind === 'busy' && state.pending.length > 0;
}

export function isAsyncRequestPending(state: AsyncState, id: number): boolean {
  return state.pending.includes(id);
}
