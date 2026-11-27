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
      return state.kind === 'editing' ? { ...state, monogram: event.value, error: null } : state;
    case 'SET_PLACEMENT':
      return state.kind === 'editing' ? { ...state, placement: event.value } : state;
    case 'INVALID':
      return state.kind === 'editing' ? { ...state, error: event.message } : state;
    case 'RENDER':
      return state.kind === 'editing'
        ? { kind: 'previewing', monogram: state.monogram, placement: state.placement, previewUrl: event.previewUrl }
        : state;
    case 'ADD':
      return state.kind === 'previewing'
        ? { kind: 'adding', monogram: state.monogram, placement: state.placement, previewUrl: state.previewUrl }
        : state;
    case 'APPROVED':
      return { kind: 'approved', lineId: event.lineId };
    case 'FAIL':
      return state.kind === 'adding' || state.kind === 'previewing'
        ? { kind: 'error', monogram: state.monogram, placement: state.placement, previewUrl: state.previewUrl, message: event.message }
        : state;
    case 'RESET':
      return state.kind === 'inactive' ? state : { kind: 'editing', monogram: '', placement: '', error: null };
    default:
      return state;
  }
}
