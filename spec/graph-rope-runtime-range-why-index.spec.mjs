import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { importDist, REPO_ROOT } from './dist-helpers.mjs';

const INDEX_SOURCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'domain',
  'graph-rope-runtime-range-why-index.ts',
);
const UTF8_ENCODING = 'utf8';
const WORLDLINE_ID = 'worldline:range-why-index';
const HEAD_ID = 'head:range-why-index';
const CHECKPOINT_ALPHA_ID = 'checkpoint:alpha';
const CHECKPOINT_MIDDLE_ID = 'checkpoint:middle';
const CHECKPOINT_ZETA_ID = 'checkpoint:zeta';
const ASSOCIATION_ALPHA_ID = 'association:alpha';
const ASSOCIATION_MIDDLE_ID = 'association:middle';
const ASSOCIATION_ZETA_ID = 'association:zeta';
const CHECKPOINT_INSERTION_ORDER = [
  CHECKPOINT_ZETA_ID,
  CHECKPOINT_ALPHA_ID,
  CHECKPOINT_MIDDLE_ID,
];
const SORTED_CHECKPOINT_IDS = [
  CHECKPOINT_ALPHA_ID,
  CHECKPOINT_MIDDLE_ID,
  CHECKPOINT_ZETA_ID,
];
const ASSOCIATION_INSERTION_ORDER = [
  ASSOCIATION_ZETA_ID,
  ASSOCIATION_ALPHA_ID,
  ASSOCIATION_MIDDLE_ID,
];
const SORTED_ASSOCIATION_IDS = [
  ASSOCIATION_ALPHA_ID,
  ASSOCIATION_MIDDLE_ID,
  ASSOCIATION_ZETA_ID,
];

test('range why indexes retain sorted unique fact identities', async () => {
  const [rangeWhyIndex, contract] = await Promise.all([
    importDist('domain', 'graph-rope-runtime-range-why-index.js'),
    importDist('domain', 'graph-rope-contract.js'),
  ]);
  const catalog = rangeWhyIndex.createGraphRopeRuntimeRangeWhyCatalog(new Map());

  for (const checkpointId of CHECKPOINT_INSERTION_ORDER) {
    catalog.indexFact(checkpointFact(contract, checkpointId));
  }
  catalog.indexFact(checkpointFact(contract, CHECKPOINT_ZETA_ID));
  for (const associationId of ASSOCIATION_INSERTION_ORDER) {
    catalog.indexFact(anchorAssociationFact(contract, associationId));
  }
  catalog.indexFact(anchorAssociationFact(contract, ASSOCIATION_ZETA_ID));

  assert.deepEqual(
    catalog.checkpointIdsForHead(HEAD_ID, Number.MAX_SAFE_INTEGER),
    SORTED_CHECKPOINT_IDS,
  );
  assert.deepEqual(
    catalog.anchorAssociationIdsForCheckpoint(CHECKPOINT_ALPHA_ID, Number.MAX_SAFE_INTEGER),
    SORTED_ASSOCIATION_IDS,
  );
});

test('range why index insertion never copies and re-sorts complete buckets', () => {
  const source = readFileSync(INDEX_SOURCE_PATH, UTF8_ENCODING);

  assert.doesNotMatch(source, /\[\.\.\.existing, factId\]/u);
  assert.doesNotMatch(source, /\.sort\s*\(/u);
});

function checkpointFact(contract, checkpointId) {
  return {
    kind: contract.ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId,
    worldlineId: WORLDLINE_ID,
    headId: HEAD_ID,
    reason: contract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  };
}

function anchorAssociationFact(contract, associationId) {
  return {
    kind: contract.ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    associationId,
    checkpointId: CHECKPOINT_ALPHA_ID,
    causalAnchorId: `anchor:${associationId}`,
    causalAnchorFactId: `anchor-fact:${associationId}`,
    causalAnchorReceiptId: `anchor-receipt:${associationId}`,
  };
}
