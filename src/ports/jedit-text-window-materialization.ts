import type { TextByteRange } from '../domain/graph-rope-types.js';
import type { HotTextWindowProjection } from './hot-text-runtime.js';

export const JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION = 1;
export const JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION = 'jedit.text-window.materializer.v1';
export const JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE = 'complete';

export interface JeditTextWindowMaterializationBasis {
  readonly worldlineId: string;
  readonly headId: string;
  /** Request namespace only. This is not evidence of an Echo-admitted frontier. */
  readonly requestFrontierRef: string;
}

export interface JeditTextWindowMaterializationKey {
  readonly schemaVersion: typeof JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION;
  readonly materializerVersion: string;
  readonly basis: JeditTextWindowMaterializationBasis;
  readonly coverage: TextByteRange;
  readonly observerPlanId: string;
  readonly policyDigest: string;
  readonly coordinateDigest: string;
  readonly cacheKeyDigest: string;
}

export interface JeditTextWindowMaterializationProvenance {
  readonly key: JeditTextWindowMaterializationKey;
  readonly completeness: typeof JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE;
  readonly materializedProjectionBytes: number;
}

export interface JeditTextWindowMaterialization extends JeditTextWindowMaterializationProvenance {
  readonly projection: HotTextWindowProjection;
}
