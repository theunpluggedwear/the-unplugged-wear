import type { ProductItem } from '@/lib/admin-dto';

export type EditorState =
  | { status: 'closed'; sequence: number }
  | { status: 'opening'; id: string; sequence: number }
  | { status: 'create'; sequence: number }
  | { status: 'edit'; product: ProductItem; sequence: number };

export type EditorAction =
  | { type: 'OPEN_CREATE' }
  | { type: 'OPEN_EDIT_START'; id: string; sequence?: number }
  | { type: 'OPEN_EDIT_DONE'; product: ProductItem; sequence?: number }
  | { type: 'OPEN_EDIT_FAIL'; sequence?: number }
  | { type: 'CLOSE' }
  | { type: 'PATCH_EDIT_PRODUCT'; patch: Partial<ProductItem> };

export const initialEditorState: EditorState = { status: 'closed', sequence: 0 };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'OPEN_CREATE':
      if (state.status === 'create') return state;
      return { status: 'create', sequence: state.sequence + 1 };
    case 'OPEN_EDIT_START':
      if (state.status === 'create') return state;
      return { status: 'opening', id: action.id, sequence: action.sequence ?? state.sequence + 1 };
    case 'OPEN_EDIT_DONE': {
      if (action.sequence !== undefined && action.sequence !== state.sequence) return state;
      if (state.status === 'opening' && state.id !== action.product.id) return state;
      return { status: 'edit', product: action.product, sequence: state.sequence };
    }
    case 'OPEN_EDIT_FAIL':
      if (action.sequence !== undefined && action.sequence !== state.sequence) return state;
      return { status: 'closed', sequence: state.sequence + 1 };
    case 'CLOSE':
      return { status: 'closed', sequence: state.sequence + 1 };
    case 'PATCH_EDIT_PRODUCT':
      return state.status === 'edit'
        ? { ...state, product: { ...state.product, ...action.patch } }
        : state;
    default:
      return state;
  }
}

export function isEditorOpen(state: EditorState): boolean {
  return state.status === 'create' || state.status === 'edit';
}

export function editorProduct(state: EditorState): ProductItem | null {
  return state.status === 'edit' ? state.product : null;
}

export function editorIsCreating(state: EditorState): boolean {
  return state.status === 'create';
}

export function editorOpeningId(state: EditorState): string | null {
  return state.status === 'opening' ? state.id : null;
}
