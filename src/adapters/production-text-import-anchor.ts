import {
  ProductionTextHostBasisKinds,
  ProductionTextObstructionCodes,
  type ProductionTextHostBasis,
  type ProductionTextImportAnchor,
  type ProductionTextObstructionCode,
} from '../app/workspace/production-text-session.js';
import { EditorFileFingerprintAlgorithms } from '../ports/editor-file.js';
import {
  EchoTextHostBasisKinds,
  EchoTextHostReopenObstructionCodes,
  type EchoTextHostBasis,
  type EchoTextHostImportAnchor,
} from '../ports/echo-text-contract-host.js';

// The host anchors each buffer to the raw-byte SHA-256 of the file it was
// imported from and refuses to reuse it for different bytes. These map that
// contract between the session and the host wire.

const REOPEN_OBSTRUCTION_CODES: ReadonlyMap<string, ProductionTextObstructionCode> = new Map([
  [EchoTextHostReopenObstructionCodes.ImportAnchorMissing, ProductionTextObstructionCodes.ImportAnchorMissing],
  [EchoTextHostReopenObstructionCodes.FileChangedSinceImport, ProductionTextObstructionCodes.FileChangedSinceImport],
  [
    EchoTextHostReopenObstructionCodes.FileAndBufferChangedSinceImport,
    ProductionTextObstructionCodes.FileAndBufferChangedSinceImport,
  ],
]);

export function echoTextHostBasis(basis: ProductionTextHostBasis): EchoTextHostBasis {
  if (basis.kind === ProductionTextHostBasisKinds.Missing) {
    return { kind: EchoTextHostBasisKinds.Missing };
  }
  return {
    kind: EchoTextHostBasisKinds.File,
    sha256: basis.fingerprint.digest,
    byteLength: basis.fingerprint.byteLength,
  };
}

export function productionTextImportAnchor(anchor: EchoTextHostImportAnchor): ProductionTextImportAnchor {
  return { headId: anchor.headId, hostBasis: productionTextHostBasis(anchor.hostBasis) };
}

function productionTextHostBasis(basis: EchoTextHostBasis): ProductionTextHostBasis {
  if (basis.kind === EchoTextHostBasisKinds.Missing) {
    return { kind: ProductionTextHostBasisKinds.Missing };
  }
  return {
    kind: ProductionTextHostBasisKinds.File,
    fingerprint: {
      algorithm: EditorFileFingerprintAlgorithms.Sha256,
      digest: basis.sha256,
      byteLength: basis.byteLength,
    },
  };
}

/** Whether the host anchored the buffer to exactly the basis the open sent. */
export function sameEchoTextHostBasis(left: EchoTextHostBasis, right: EchoTextHostBasis): boolean {
  if (left.kind === EchoTextHostBasisKinds.Missing || right.kind === EchoTextHostBasisKinds.Missing) {
    return left.kind === right.kind;
  }
  return left.sha256 === right.sha256 && left.byteLength === right.byteLength;
}

/** The session obstruction for a host open refusal; reopen refusals keep their reason. */
export function openObstructionCode(hostCode: string): ProductionTextObstructionCode {
  return REOPEN_OBSTRUCTION_CODES.get(hostCode) ?? ProductionTextObstructionCodes.Open;
}
