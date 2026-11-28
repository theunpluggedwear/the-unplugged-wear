export type PersonalizationState =
  | { kind: 'inactive' }
  | { kind: 'editing'; monogram: string; placement: string; error: string | null }
  | { kind: 'previewing'; monogram: string; placement: string; previewUrl: string }
  | { kind: 'adding'; monogram: string; placement: string; previewUrl: string }
  | { kind: 'approved'; lineId: string }
  | { kind: 'error'; monogram: string; placement: string; previewUrl: string; message: string };

export type PersonalizationEvent =
  | { type: 'ENABLE' }
  | { type: 'SET_MONOGRAM'; value: string }
  | { type: 'SET_PLACEMENT'; value: string }
  | { type: 'INVALID'; message: string }
  | { type: 'RENDER'; previewUrl: string }
  | { type: 'ADD' }
  | { type: 'APPROVED'; lineId: string }
  | { type: 'FAIL'; message: string }
  | { type: 'RESET' };

export const initialPersonalizationState: PersonalizationState = { kind: 'inactive' };

export function personalizationReducer(state: PersonalizationState, event: PersonalizationEvent): PersonalizationState {
  switch (event.type) {
    case 'ENABLE':
      return state.kind === 'inactive' ? { kind: 'editing', monogram: '', placement: '', error: null } : state;
    case 'SET_MONOGRAM':
      if (state.kind === 'editing') return { ...state, monogram: event.value, error: null };
      return state.kind === 'error'
        ? { kind: 'editing', monogram: event.value, placement: state.placement, error: null }
        : state;
    case 'SET_PLACEMENT':
      if (state.kind === 'editing') return { ...state, placement: event.value };
      return state.kind === 'error'
        ? { kind: 'editing', monogram: state.monogram, placement: event.value, error: null }
        : state;
    case 'INVALID':
      if (state.kind === 'editing') return { ...state, error: event.message };
      return state.kind === 'error' ? { ...state, message: event.message } : state;
    case 'RENDER':
      if (state.kind === 'editing' || state.kind === 'error') {
        return { kind: 'previewing', monogram: state.monogram, placement: state.placement, previewUrl: event.previewUrl };
      }
      return state;
    case 'ADD':
      return state.kind === 'previewing'
        ? { kind: 'adding', monogram: state.monogram, placement: state.placement, previewUrl: state.previewUrl }
        : state;
    case 'APPROVED':
      return state.kind === 'adding' ? { kind: 'approved', lineId: event.lineId } : state;
    case 'FAIL':
      return state.kind === 'adding' || state.kind === 'previewing'
        ? { kind: 'error', monogram: state.monogram, placement: state.placement, previewUrl: state.previewUrl, message: event.message }
        : state;
    case 'RESET':
      return state.kind === 'inactive' ? state : { kind: 'inactive' };
    default:
      return state;
  }
}
