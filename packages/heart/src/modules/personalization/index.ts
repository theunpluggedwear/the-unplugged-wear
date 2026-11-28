import { registerFeaturePlugin } from '../../platform/plugins/index.ts';
import { personalizationPlugin } from './rules.ts';

export { personalizationPlugin } from './rules.ts';
export { demoTemplateFor, demoTemplates } from './templates.ts';
export type { QikinkDemoTemplate, QikinkPlacementCode, QikinkPrintTypeId, TemplateCategory } from './templates.ts';
export {
  designFieldsFromOrderItem, hasPersonalizationDesignFields, isDemoPreview,
  personalizationDesignPayload, qikinkRealMode,
} from './payload.ts';
export type { DesignPayloadLine, PersonalizationDesignPayload, QikinkDesign } from './payload.ts';
export type {
  PersonalizationLike, PersonalizationPort, PersonalizationCartLine,
  PersonalizationProductCapability, PersonalizationProductRow,
} from '../../platform/plugins/personalization.ts';

registerFeaturePlugin('personalization', personalizationPlugin);
