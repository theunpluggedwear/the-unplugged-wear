import type { ImportPreview } from './sections/types';

export type ImportState =
  | { status: 'idle' }
  | { status: 'preview'; preview: ImportPreview }
  | { status: 'importing'; preview: ImportPreview };

export type ImportEvent =
  | { type: 'SHOW_PREVIEW'; preview: ImportPreview }
  | { type: 'START_IMPORT' }
  | { type: 'FINISH_IMPORT' }
  | { type: 'CANCEL' };

export const initialImportState: ImportState = { status: 'idle' };

export function importReducer(state: ImportState, event: ImportEvent): ImportState {
  switch (event.type) {
    case 'SHOW_PREVIEW':
      return { status: 'preview', preview: event.preview };
    case 'START_IMPORT':
      return state.status === 'preview' ? { status: 'importing', preview: state.preview } : state;
    case 'FINISH_IMPORT':
      return state.status === 'importing' ? { status: 'preview', preview: state.preview } : state;
    case 'CANCEL':
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

export function importPreviewOf(state: ImportState): ImportPreview | null {
  return state.status === 'idle' ? null : state.preview;
}
