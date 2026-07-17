import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

test('gutter and footer explanations project the active range why evidence', async () => {
  const [projection, footer] = await Promise.all([
    importDist('app', 'workspace', 'workspace-source-projection.js'),
    importDist('app', 'workspace', 'workspace-footer-posture.js'),
  ]);
  const report = rangeWhyReport();
  const model = modelWithWhyReport(report);

  const reading = projection.sourceGutterExecutionReadings(model)[0];

  assert.deepEqual(reading.whyEvidence, {
    headId: report.witness.basisHeadId,
    rewriteIds: [report.witness.result.fragments[0].origin.rewriteId],
    diffIds: [report.witness.result.fragments[0].origin.diffId],
    tickReceiptIds: [report.witness.result.fragments[0].origin.textTickReceiptId],
  });
  assert.equal(
    footer.workspaceFooterWhyEvidencePosture(model),
    'head=head:next tick=tick:why anchor=anchor:why coverage=complete',
  );
  assert.equal(
    footer.workspaceFooterTextPosture(model),
    'head=head:next tick=tick:why anchor=anchor:why coverage=complete',
  );
});

test('range detail rows preserve the terminal evidence protocol', async () => {
  const details = await importDist('app', 'workspace', 'workspace-why-range-details.js');

  assert.deepEqual(details.jeditWhyRangeDetailRows(rangeWhyReport()), [
    'basisHeadId=head:next',
    'range=4..8 coverage=COMPLETE',
    'span=4..8 leafId=leaf:why blobId=blob:why',
    'origin=REWRITE rewriteId=rewrite:why diffId=diff:why',
    'textTickReceiptId=tick:why basisHeadId=head:basis nextHeadId=head:next',
    'producerEvidence=UNAVAILABLE code=jedit_why_range_producer_evidence_unavailable',
    'checkpointId=checkpoint:why headId=head:next reason=manual-save',
    'causalAnchorId=anchor:why causalAnchorReceiptId=anchor-receipt:why',
    'inspectedFactCount=8',
  ]);
});

test('gutter explanation refuses why evidence unsupported by its causal marker', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const model = modelWithWhyReport(rangeWhyReport(), {
    rewriteIds: ['rewrite:other'],
    diffIds: ['diff:other'],
    tickReceiptIds: ['tick:other'],
  });

  const reading = projection.sourceGutterExecutionReadings(model)[0];

  assert.equal(Object.hasOwn(reading, 'whyEvidence'), false);
});

test('footer explanation refuses a range report after its head becomes stale', async () => {
  const footer = await importDist('app', 'workspace', 'workspace-footer-posture.js');
  const model = modelWithWhyReport(rangeWhyReport());
  const stale = {
    ...model,
    textAuthority: {
      ...model.textAuthority,
      durability: {
        ...model.textAuthority.durability,
        causal: { kind: 'admitted', headId: 'head:newer' },
      },
    },
  };

  assert.equal(footer.workspaceFooterWhyEvidencePosture(stale), undefined);
});

test('footer explanation omits anchor posture when the report has no association', async () => {
  const footer = await importDist('app', 'workspace', 'workspace-footer-posture.js');
  const report = rangeWhyReport();
  const unanchored = {
    ...report,
    witness: {
      ...report.witness,
      result: {
        ...report.witness.result,
        relatedCheckpoints: report.witness.result.relatedCheckpoints.map(checkpoint => ({
          ...checkpoint,
          anchorAssociation: null,
        })),
      },
    },
  };

  assert.equal(
    footer.workspaceFooterWhyEvidencePosture(modelWithWhyReport(unanchored)),
    'head=head:next tick=tick:why coverage=complete',
  );
});

function modelWithWhyReport(report, markerEvidence = reportMarkerEvidence(report)) {
  return {
    i18n: {
      t: path => path.slice(path.lastIndexOf('.') + 1),
    },
    editor: { cursorRow: 1, cursorCol: 4 },
    focusPane: 'editor',
    viewMode: 'source',
    commandLine: { active: false },
    causalGutterBasis: { kind: 'last-save' },
    inlinePanel: {
      title: report.title,
      message: report.message,
      tone: 'info',
      anchorRow: 1,
      anchorColumn: 4,
      basisHeadId: report.witness.basisHeadId,
      bufferId: 'buffer:why',
      whyRangeReport: report,
    },
    textAuthority: {
      kind: 'opened',
      bufferId: 'buffer:why',
      cache: { projection: { basisHeadId: 'head:next' } },
      durability: {
        causal: {
          kind: 'admitted',
          headId: 'head:next',
          admittedTickId: 'tick:not-in-range-report',
          receiptId: 'receipt:not-in-range-report',
        },
        file: { kind: 'saved', basisHeadId: 'head:basis' },
        lineChanges: causalLineChanges(markerEvidence),
      },
    },
  };
}

function causalLineChanges(markerEvidence) {
  return {
    kind: 'available',
    source: 'causal-observation',
    basisHeadId: 'head:basis',
    nextHeadId: 'head:next',
    insertedLineCount: 0,
    deletedLineCount: 0,
    ...markerEvidence,
    markers: [{ lineNumber: 1, kind: 'MODIFIED', ...markerEvidence }],
    deletions: [],
    observerVersion: 'test-fixture',
  };
}

function reportMarkerEvidence(report) {
  const origin = report.witness.result.fragments[0].origin;
  return {
    rewriteIds: [origin.rewriteId],
    diffIds: [origin.diffId],
    tickReceiptIds: [origin.textTickReceiptId],
  };
}

function rangeWhyReport() {
  return {
    kind: 'range',
    title: 'Why range',
    message: 'retained range evidence',
    witness: {
      worldlineId: 'worldline:why',
      basisHeadId: 'head:next',
      queriedRange: { startByte: 4, endByte: 8 },
      result: {
        kind: 'produced',
        coverage: {
          kind: 'COMPLETE',
          coveredRange: { startByte: 4, endByte: 8 },
          continuation: null,
          reason: null,
        },
        fragments: [{
          coveredRange: { startByte: 4, endByte: 8 },
          headId: 'head:next',
          leafId: 'leaf:why',
          blobId: 'blob:why',
          origin: {
            kind: 'REWRITE',
            rewriteId: 'rewrite:why',
            diffId: 'diff:why',
            textTickReceiptId: 'tick:why',
            basisHeadId: 'head:basis',
            nextHeadId: 'head:next',
            producerEvidence: {
              kind: 'UNAVAILABLE',
              code: 'jedit_why_range_producer_evidence_unavailable',
            },
          },
        }],
        relatedCheckpoints: [{
          checkpointId: 'checkpoint:why',
          headId: 'head:next',
          reason: 'manual-save',
          anchorAssociation: {
            associationId: 'association:why',
            causalAnchorId: 'anchor:why',
            causalAnchorFactId: 'anchor-fact:why',
            causalAnchorReceiptId: 'anchor-receipt:why',
          },
        }],
        inspectedFactCount: 8,
        observerVersion: 'test-fixture',
      },
    },
  };
}
