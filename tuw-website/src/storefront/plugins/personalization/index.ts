export { default as PersonalizationPanel } from './PersonalizationPanel';
export type { PersonalizationPanelProps } from './PersonalizationPanel';
export { default as BagPreview } from './BagPreview';
export { default as PreviewCarousel } from './PreviewCarousel';
export type { PreviewCarouselProps } from './PreviewCarousel';
export { personalizationReducer, initialPersonalizationState } from './personalization-machine';
export type { PersonalizationState, PersonalizationEvent } from './personalization-machine';
export {
  previewUrlFor, validateMonogram, escapeXml, PREVIEW_ANGLES, PREVIEW_FAMILIES,
  isPreviewAngle, isPreviewFamily, previewImageFor, previewFamilyFor,
} from './preview-url';
export type { PreviewInput, PreviewAngle, PreviewFamily, PreviewFamilyInput } from './preview-url';

export const personalizationPlugin = {
  id: 'personalization',
  slots: ['pdpBuyBox', 'bagLine'],
};
