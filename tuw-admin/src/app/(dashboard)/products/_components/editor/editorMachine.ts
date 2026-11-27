import type { ProductItem } from '@/lib/admin-dto';

export type EditorState =
  | { status: 'closed' }
  | { status: 'opening'; id: string }
  | { status: 'create' }
  | { status: 'edit'; product: ProductItem };

export type EditorAction =
  | { type: 'OPEN_CREATE' }
  | { type: 'OPEN_EDIT_START'; id: string }
  | { type: 'OPEN_EDIT_DONE'; product: ProductItem }
  | { type: 'OPEN_EDIT_FAIL' }
  | { type: 'CLOSE' }
  | { type: 'PATCH_EDIT_PRODUCT'; patch: Partial<ProductItem> };

export const initialEditorState: EditorState = { status: 'closed' };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'OPEN_CREATE':
      return { status: 'create' };
    case 'OPEN_EDIT_START':
      return { status: 'opening', id: action.id };
    case 'OPEN_EDIT_DONE':
      return { status: 'edit', product: action.product };
    case 'OPEN_EDIT_FAIL':
    case 'CLOSE':
      return { status: 'closed' };
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
