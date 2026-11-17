// Generates edict/replace-range/rope/edict.lawpack.json, the `jedit.text@2`
// lawpack authoring document for the persistent-rope ReplaceRange. The
// echo.dpo@2 profile, Target IR and intrinsic catalog pins come from
// rope/echo-dpo-2-profile.json; the graph schema and footprint law are
// derived from the #404 fixture profile's type ids.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, '..', '..', 'contracts', 'jedit', 'acceptance', 'replace-range-schema-2',
  'replace-range-schema-2.fixtures.json');
const LAWPACK = 'jedit.text@2';
const ADDRESSING = Object.freeze({ content: 0, mutable: 1 });
const ID = 'Bytes<exact=32>';
// Echo's effect-program configuration admits at most 16 MiB of allocation.
const EFFECT_ALLOCATION_CEILING = 16777216;
// A reference step ceiling, exact in JSON; the envelope budget is measured under v2.
const REFERENCE_STEPS = Number.MAX_SAFE_INTEGER;

/** The v1 envelope. Fold and list bounds in src/rope are literals equal to these. */
export const envelope = Object.freeze({
  maxTreeHeight: 32, maxLeafBytes: 4096, maxReplacementBytes: 16384, maxClosureNodes: 256,
  maxClosureOccurrences: 128, maxClosureEdges: 256, maxArenaNodes: 512, maxFreshNodes: 256,
  maxCreatedLeaves: 16, maxCreatedBranches: 128, maxEmittedNodes: 144,
  maxNoOpLeaves: 64, maxEffects: 1024,
});

/**
 * The read-set envelope a row check enforces (#296 ruling): the Buffer node
 * plus at most the closure's nodes, and closure depth at most the tree height
 * plus the Head.
 */
export const ropeReadBounds = Object.freeze({
  maxReadNodes: envelope.maxClosureNodes + 1, maxClosureDepth: envelope.maxTreeHeight + 1,
});

const obstructions = Object.freeze([
  ['FactMissing', 'resourceFault'], ['FactMalformed', 'integrityFault'], ['BasisNotCanonical', 'domainMappable'],
  ['RangeOrderInvalid', 'domainMappable'], ['ReplacementNotUtf8', 'domainMappable'],
  ['RangeOutOfBounds', 'domainMappable'], ['ResourceLimitExceeded', 'resourceFault'],
  ['ContentIdentityMismatch', 'integrityFault'], ['MalformedRope', 'integrityFault'],
  ['ClosureInsufficient', 'integrityFault'], ['Utf8BoundaryInvalid', 'domainMappable'], ['NoOp', 'domainMappable'],
  ['ArithmeticOverflow', 'integrityFault'],
]);

// ---- canonical CBOR (definite lengths, shortest integers, sorted keys) ----
function head(major, value) {
  const v = BigInt(value);
  const shifted = major << 5;
  if (v < 24n) return Buffer.from([shifted | Number(v)]);
  for (const [info, width] of [[24, 1], [25, 2], [26, 4], [27, 8]]) {
    if (v < 1n << BigInt(8 * width)) {
      const out = Buffer.alloc(1 + width);
      out[0] = shifted | info;
      for (let i = 0; i < width; i += 1) out[width - i] = Number((v >> BigInt(8 * i)) & 0xffn);
      return out;
    }
  }
  throw new RangeError('integer too large');
}
export function cbor(value) {
  if (typeof value === 'number' || typeof value === 'bigint') return head(0, value);
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (typeof value === 'string') return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (Array.isArray(value)) return Buffer.concat([head(4, value.length), ...value.map(cbor)]);
  const entries = (value instanceof Map ? [...value] : Object.entries(value))
    .map(([key, item]) => [cbor(key), cbor(item)])
    .sort(([a], [b]) => a.length - b.length || Buffer.compare(a, b));
  return Buffer.concat([head(5, entries.length), ...entries.flat()]);
}

const hexId = (id) => Buffer.from(id, 'hex');

function graphSchema(profile) {
  const nodes = new Map();
  for (const kind of ['Buffer', 'Head', 'Branch', 'Leaf', 'Import']) {
    nodes.set(hexId(profile.nodeTypes[kind].id), {
      addressing: kind === 'Buffer' ? ADDRESSING.mutable : ADDRESSING.content,
      atom_types: [hexId(profile.atomTypes[kind].id)],
    });
  }
  const type = (kind) => hexId(profile.nodeTypes[kind].id);
  const pairs = (list) => list.map(([from, to]) => [type(from), type(to)])
    .sort((a, b) => Buffer.compare(Buffer.concat(a), Buffer.concat(b)));
  const tree = [['Branch', 'Branch'], ['Branch', 'Leaf']];
  const edges = new Map([
    [hexId(profile.edgeTypes.canonicalHead.id), pairs([['Buffer', 'Head']])],
    [hexId(profile.edgeTypes.root.id), pairs([['Head', 'Branch'], ['Head', 'Leaf']])],
    [hexId(profile.edgeTypes.anchor.id), pairs([['Head', 'Import']])],
    [hexId(profile.edgeTypes.left.id), pairs(tree)],
    [hexId(profile.edgeTypes.right.id), pairs(tree)],
  ]);
  return cbor({ node_types: nodes, edge_types: edges });
}

const sortedIds = (ids) => ids.map(hexId).sort(Buffer.compare);

function footprintLaw(profile) {
  const nodeIds = ['Buffer', 'Head', 'Branch', 'Leaf'].map((kind) => profile.nodeTypes[kind].id);
  const edgeIds = ['canonicalHead', 'root', 'anchor', 'left', 'right'].map((edge) => profile.edgeTypes[edge].id);
  return cbor({
    max_reads: envelope.maxClosureNodes * 2, max_writes: envelope.maxEffects, max_range_edges: envelope.maxClosureNodes * 2,
    atom_types: sortedIds(['Buffer', 'Head', 'Branch', 'Leaf'].map((kind) => profile.atomTypes[kind].id)),
    read_node_types: sortedIds(nodeIds), range_edge_types: sortedIds(edgeIds),
    write_node_types: sortedIds(nodeIds.slice(1)), write_edge_types: sortedIds(edgeIds), portal_owner_types: [],
  });
}

const GUIDE = 'Record<end:U64,hi:U64,lo:U64,mode:U64,range:Bool,start:U64>';
const NODE_ROW = `Record<atomBytes:Bytes<max=4352>,atomType:Bytes<max=32>,nodeId:${ID},nodeType:${ID}>`;
const types = Object.freeze({
  Guide: GUIDE, NodeRow: NODE_ROW,
  ClosureQuery: `Record<edgeTypes:List<${ID},max=3>,guide:${GUIDE},maxDepth:U64,maxNodes:U64,nodeId:${ID},warpId:${ID}>`,
  Closure: `Record<edges:List<Record<edgeId:${ID},from:U64,node:U64,slot:U64>,max=256>,nodes:List<${NODE_ROW},max=256>,`
    + `occurrences:List<Record<depth:U64,edge:U64,guide:${GUIDE},node:U64>,max=128>>`,
  NodeId: ID, Atom: 'Bytes<max=4352>', Replacement: `Bytes<max=${envelope.maxReplacementBytes}>`,
  Detail: 'String<max=256,canonical=raw-utf8>', Written: 'Record<>',
  AtomQuery: `Record<nodeId:${ID},typeId:${ID},warpId:${ID}>`,
  EdgeQuery: `Record<edgeType:${ID},nodeId:${ID},warpId:${ID}>`,
  Edges: `List<Record<edgeId:${ID},toId:${ID}>,max=2>`,
  NodeWrite: `Record<atomBytes:Bytes<max=25344>,atomType:${ID},nodeId:${ID},nodeType:${ID},warpId:${ID}>`,
  AtomReplace: `Record<atomBytes:Bytes<max=4352>,atomType:${ID},expectedAtomDigest:${ID},nodeId:${ID},warpId:${ID}>`,
  EdgeWrite: `Record<edgeId:${ID},edgeType:${ID},fromId:${ID},toId:${ID},warpId:${ID}>`,
  EdgeReplace: `Record<edgeId:${ID},expectedToId:${ID},toId:${ID},warpId:${ID}>`,
});

const effects = Object.freeze([
  ['readAtom', 'node-atom-read', 'AtomQuery', 'Atom', 'read',
    { missing: 'atomMissing', required: 'atomRequired', wrongType: 'atomTypeMismatch', tooLarge: 'atomByteBoundExceeded' }],
  ['outgoing', 'outgoing-edge-read', 'EdgeQuery', 'Edges', 'read',
    { sourceMissing: 'edgeSourceMissing', edgeBound: 'edgeBoundExceeded', scanBound: 'edgeScanBoundExceeded' }],
  ['closure', 'closure-read', 'ClosureQuery', 'Closure', 'read', {
    startMissing: 'closureStartMissing', nodeBound: 'closureNodeBoundExceeded', depthBound: 'closureDepthBoundExceeded',
    scanBound: 'closureScanBoundExceeded', workBound: 'closureWorkBoundExceeded',
    selectorInsufficient: 'closureSelectorInsufficient', storageMalformed: 'closureStorageMalformed' }],
  ['ensureNode', 'ensure-node', 'NodeWrite', 'Written', 'ensure', {}],
  ['ensureEdge', 'ensure-edge', 'EdgeWrite', 'Written', 'ensure', {}],
  ['replaceAtom', 'replace-atom', 'AtomReplace', 'Written', 'replace', {}],
  ['replaceEdge', 'replace-edge', 'EdgeReplace', 'Written', 'replace', {}],
]);

const coordinate = (name) => `${LAWPACK}.${name}`;
const RESOURCE_FAILURES = new Set(['missing', 'tooLarge', 'sourceMissing', 'edgeBound', 'scanBound', 'startMissing',
  'nodeBound', 'depthBound', 'workBound']);
const DOMAIN_FAILURES = new Set(['selectorInsufficient']);

export function ropeLawpack() {
  const profile = JSON.parse(readFileSync(FIXTURES, 'utf8')).profile;
  const pins = JSON.parse(readFileSync(path.join(ROOT, 'rope', 'echo-dpo-2-profile.json'), 'utf8'));
  const failureClass = (name) => {
    if (RESOURCE_FAILURES.has(name)) return 'resourceFault';
    return DOMAIN_FAILURES.has(name) ? 'domainMappable' : 'integrityFault';
  };
  const exportedEffects = effects.map(([name, , input, output, kind, failures]) => ({
    coordinate: coordinate(name), typeParameters: [], inputType: coordinate(input), outputType: coordinate(output),
    executionClass: 'runtime', effectKindHint: kind, footprintObligation: coordinate('replaceRangeFootprint'),
    costObligation: coordinate('replaceRangeBudget'),
    effectFailures: Object.fromEntries(Object.keys(failures).map((failure) => [failure,
      { authorityClass: failureClass(failure), payloadType: coordinate(input) }])),
    guardSupport: true,
  }));
  const implementations = Object.fromEntries(effects.map(([name, intrinsic, , , kind, failures]) => [coordinate(name), {
    targetIntrinsic: `echo.dpo@2.${intrinsic}`, targetConfiguration: { local: 'echo-config' }, writeClass: kind,
    footprintObligation: coordinate('replaceRangeFootprint'), costObligation: coordinate('replaceRangeBudget'),
    failureMappings: failures,
  }]));
  return {
    schema: 'edict.lawpack-build/v1', outputDirectory: 'vendor/jedit-text-2', dependencyBundles: [],
    lawpack: {
      schema: 'edict.lawpack-authoring/v1', id: 'jedit.text', version: '2', acceptedCoreAbi: ['edict.core/v1'],
      dependencies: [], exportsCoordinate: 'jedit.text.exports/v2',
      exports: {
        types: Object.entries(types).map(([name, definition]) => ({ coordinate: coordinate(name), definition })),
        // Closure types are written out, not by reference, as Echo's closure ABI requires.
        constants: Object.entries(envelope).map(([name, value]) => ({ coordinate: coordinate(name), type: 'U64', value })),
        pureFunctions: [],
        effects: exportedEffects,
        obstructions: obstructions.map(([name, authorityClass]) => ({
          coordinate: coordinate(name), authorityClass, payloadSchema: coordinate('Detail'),
        })),
        operationProfiles: { [coordinate('replaceRange')]: {
          opticTemplate: { ...pins.opticTemplate, supportPolicy: coordinate('basisBoundSupport'),
            lossDisposition: coordinate('lossless'), basisTemplate: coordinate('exactHeadBasis'),
            apertureRequirement: { kind: 'abstractFootprintObligation', reference: coordinate('replaceRangeFootprint') } },
          effectPredicate: coordinate('replaceRangeEffects'),
        } },
      },
      targetAdapters: [{
        coordinate: 'jedit.text.echo-adapter/v2', output: 'adapter.cbor',
        acceptedTargetProfile: pins.profile, acceptedTargetIr: pins.targetIr,
        operationProfiles: { [coordinate('replaceRange')]: {
          core: 'continuum.profile.graph-effects/v1', semanticEffects: effects.map(([name]) => coordinate(name)),
          budgetObligation: coordinate('replaceRangeBudget'), targetConfiguration: { local: 'echo-config' },
        } },
        effectImplementations: implementations,
        // A v1-schedule reference ceiling only; the envelope budget is measured under v2 (amblicit#330).
        budgets: { [coordinate('replaceRangeBudget')]: {
          maxSteps: REFERENCE_STEPS, maxAllocatedBytes: EFFECT_ALLOCATION_CEILING, maxOutputBytes: 1048576,
        } },
      }],
      verifier: { class: 'declarative', ruleset: { local: 'verifier-rules' } },
      compatibility: { local: 'compatibility' },
      conformanceFixtureCorpus: { local: 'fixtures' },
      localResources: [
        { name: 'echo-config', coordinate: 'echo.operation-lowering-configuration/v1',
          output: 'echo-operation-configuration.cbor', value: {
            apiVersion: 'echo.operation-lowering-configuration/v1', programKind: 'edict-effect-program/v1',
            identityLaw: 1, intrinsicCatalog: { $edictBytes: pins.intrinsicCatalogHex },
            graphSchema: { $edictBytes: graphSchema(profile).toString('hex') },
            footprintLaw: { $edictBytes: footprintLaw(profile).toString('hex') },
            graphReads: { maxEdgeScans: 64, maxClosureNodes: envelope.maxClosureNodes,
              maxClosureDepth: envelope.maxTreeHeight, closureSelector: 'select' },
            maxInputBytes: 65536, maxResultBytes: 4096, maxAllocatedBytes: EFFECT_ALLOCATION_CEILING,
            budgetCeiling: { steps: REFERENCE_STEPS, readBytes: 4194304, writeBytes: 4194304 },
            authorityProfile: 'jedit.text.authority/v2',
          } },
        { name: 'verifier-rules', coordinate: 'jedit.text.verifier-rules/v2', output: 'verifier-rules.cbor',
          value: { schema: 'jedit.text.schema@2', oracleIsExecutableInput: false, runtimeOntology: 'generic-bounded-graph' } },
        { name: 'compatibility', coordinate: 'jedit.text.compatibility/v2', output: 'compatibility.cbor',
          value: { core: 'edict.core/v1', target: pins.targetIr.id } },
        { name: 'fixtures', coordinate: 'jedit.text.ReplaceRange.schema-2-fixtures/v1', output: 'fixtures.cbor',
          value: { fixtures: 'contracts/jedit/acceptance/replace-range-schema-2' } },
      ],
    },
  };
}

export function ropeLawpackText() {
  return `${JSON.stringify(ropeLawpack(), null, 2)}\n`;
}
