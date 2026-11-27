import { registerFeaturePlugin } from '../../platform/plugins/index.ts';
import { personalizationPlugin } from './rules.ts';

export { personalizationPlugin } from './rules.ts';
export type {
  PersonalizationLike, PersonalizationPort, PersonalizationCartLine,
  PersonalizationProductCapability, PersonalizationProductRow,
} from '../../platform/plugins/personalization.ts';

registerFeaturePlugin('personalization', personalizationPlugin);
