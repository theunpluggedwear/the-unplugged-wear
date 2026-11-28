export type AsyncState<T = undefined> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: T }
  | { kind: 'error'; message: string };

export type AsyncEvent<T> =
  | { type: 'START' }
  | { type: 'SUCCESS'; data: T }
  | { type: 'FAIL'; message: string }
  | { type: 'RESET' };

export const initialAsync: AsyncState<never> = { kind: 'idle' };

export function asyncReducer<T>(state: AsyncState<T>, event: AsyncEvent<T>): AsyncState<T> {
  switch (event.type) {
    case 'START': return { kind: 'loading' };
    case 'SUCCESS': return { kind: 'success', data: event.data };
    case 'FAIL': return { kind: 'error', message: event.message };
    case 'RESET': return { kind: 'idle' };
  }
}
