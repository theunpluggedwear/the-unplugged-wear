import type { ImportPreview } from './sections/types';

export type ImportState =
  | { status: 'idle' }
  | { status: 'preview'; preview: ImportPreview }
  | { status: 'importing'; preview: ImportPreview; cancelRequested: boolean };

export type ImportEvent =
  | { type: 'SHOW_PREVIEW'; preview: ImportPreview }
  | { type: 'START_IMPORT' }
  | { type: 'FINISH_IMPORT' }
  | { type: 'CANCEL' };

export const initialImportState: ImportState = { status: 'idle' };

export function importReducer(state: ImportState, event: ImportEvent): ImportState {
  switch (event.type) {
    case 'SHOW_PREVIEW':
      if (state.status === 'importing') return state;
      return { status: 'preview', preview: event.preview };
    case 'START_IMPORT':
      return state.status === 'preview' ? { status: 'importing', preview: state.preview, cancelRequested: false } : state;
    case 'FINISH_IMPORT': {
      if (state.status !== 'importing') return state;
      return state.cancelRequested ? { status: 'idle' } : { status: 'preview', preview: state.preview };
    }
    case 'CANCEL':
      if (state.status === 'importing') return { ...state, cancelRequested: true };
      return { status: 'idle' };
    default:
      return state;
  }
}

export function isImportModalOpen(state: ImportState): boolean {
  return state.status !== 'idle';
}

export function isImporting(state: ImportState): boolean {
  return state.status === 'importing';
}

export function isImportCancelRequested(state: ImportState): boolean {
  return state.status === 'importing' && state.cancelRequested;
}

export function importPreviewOf(state: ImportState): ImportPreview | null {
  return state.status === 'idle' ? null : state.preview;
}
