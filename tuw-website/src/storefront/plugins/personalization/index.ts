export { default as PersonalizationPanel } from './PersonalizationPanel';
export type { PersonalizationPanelProps } from './PersonalizationPanel';
export { default as BagPreview } from './BagPreview';
export { handlePreviewRequest } from './previewRoute';
export { personalizationReducer, initialPersonalizationState } from './personalization-machine';
export type { PersonalizationState, PersonalizationEvent } from './personalization-machine';
export { previewUrlFor, validateMonogram, escapeXml } from './preview-url';

export const personalizationPlugin = {
  id: 'personalization',
  slots: ['pdpBuyBox', 'bagLine'],
};
