import type { TextWindowBasis } from '../../ports/text-authority-evidence.js';

export interface ProductionTextBasisRequest extends TextWindowBasis {
  readonly bufferId: string;
  readonly atMs: number;
}

export interface ProductionTextViewportAperture {
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly beforeLines: number;
  readonly afterLines: number;
  readonly maxBytes: number;
}

export interface ProductionTextWindowRequest extends ProductionTextBasisRequest {
  readonly aperture: ProductionTextViewportAperture;
}

export type ProductionTextExportRequest = ProductionTextBasisRequest;
