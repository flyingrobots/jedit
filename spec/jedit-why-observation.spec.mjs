import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist, mockEditor } from './workspace-helpers.mjs';

test('why observation coordinates command events to reading aperture evidence', async () => {
  const [mode, syntax, executor, authority, profile, provenance, whyObservation] = await Promise.all([
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'vim-chord-syntax.js'),
    importDist('app', 'workspace', 'vim-command-executor.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'command-provenance.js'),
    importDist('app', 'workspace', 'jedit-why-observation.js'),
  ]);
  const cache = windowReadingCache();
  const edited = executor.applyVimChordSyntaxToEditor(
    mockEditor(mode, { lines: ['alpha beta', 'gamma'], cursorRow: 0, cursorCol: 0 }),
    syntax.parseVimChordSyntax(['d', 'w']),
  );
  assert.ok(edited.lastVimEdit);

  const event = provenance.createJeditCommandEvent({
    editor: edited,
    repeat: edited.lastVimEdit,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: '/repo/notes.md',
      bufferId: 'buffer:notes',
      readOnly: false,
      dirty: false,
      cache,
      lastReceiptId: 'receipt:dw',
    }),
  });

  assert.equal(event.kind, 'vim');
  assert.equal(event.observation.authority.kind, authority.WorkspaceTextAuthorityKinds.Opened);
  assert.equal(event.observation.coordinate.basisDigest, event.basisDigest);
  assert.equal(event.observation.coordinate.filePath, '/repo/notes.md');
  assert.equal(event.observation.coordinate.bufferId, 'buffer:notes');
  assert.equal(event.observation.coordinate.readingId, 'reading:window');
  assert.equal(event.observation.coordinate.aperture.coverage, 'window');
  assert.equal(event.observation.coordinate.aperture.startLine, 1);
  assert.equal(event.observation.coordinate.aperture.returnedLineCount, 1);
  assert.equal(event.observation.coordinate.aperture.totalLineCount, 2);
  assert.equal(event.observation.coordinate.target.rangeStart, 0);
  assert.equal(event.observation.coordinate.target.rangeEnd, 6);
  assert.equal(event.observation.evidence.posture, whyObservation.JeditWhyEvidencePostures.Available);
  assert.deepEqual(
    event.observation.evidence.sources.map((source) => source.kind),
    [
      whyObservation.JeditWhyEvidenceSourceKinds.LocalEditorProvenance,
      whyObservation.JeditWhyEvidenceSourceKinds.LocalTextWindowEnvelope,
      whyObservation.JeditWhyEvidenceSourceKinds.ReceiptReference,
    ],
  );
  assert.equal(event.observation.evidence.nativeContinuumWitness, false);
  assert.equal(hasEvidenceSource(event.observation, whyObservation.JeditWhyEvidenceSourceKinds.EchoReadingEnvelope), false);
});

test('why observation represents no-echo, missing, stale, obstructed, and proof sources', async () => {
  const [mode, authority, profile, provenance, whyObservation] = await Promise.all([
    importDist('app', 'workspace', 'editor', 'mode.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'command-provenance.js'),
    importDist('app', 'workspace', 'jedit-why-observation.js'),
  ]);
  const noEcho = authority.createWorkspaceTextAuthority(profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED);
  const event = provenance.createJeditCommandEvent({
    editor: mockEditor(mode, {
      lastVimEdit: repeatWithTarget('basis:no-echo'),
    }),
    repeat: repeatWithTarget('basis:no-echo'),
    textAuthority: noEcho,
  });
  assert.equal(event.kind, 'vim');
  assert.equal(event.receipt.posture, 'unavailable');
  assert.equal(event.observation.evidence.posture, whyObservation.JeditWhyEvidencePostures.Unavailable);
  assert.equal(
    event.observation.evidence.sources[0].kind,
    whyObservation.JeditWhyEvidenceSourceKinds.LocalEditorProvenance,
  );

  const missing = whyObservation.createJeditWhyObservation({
    basisDigest: 'basis:missing',
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: '/repo/notes.md',
      bufferId: 'buffer:notes',
      readOnly: false,
      dirty: false,
    }),
  });
  assert.equal(missing.evidence.posture, whyObservation.JeditWhyEvidencePostures.MissingEnvelope);

  const stale = whyObservation.createJeditWhyObservation({
    basisDigest: 'basis:stale',
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: '/repo/notes.md',
      bufferId: 'buffer:notes',
      readOnly: false,
      dirty: true,
      cache: windowReadingCache(),
    }),
  });
  assert.equal(stale.evidence.posture, whyObservation.JeditWhyEvidencePostures.StaleBasis);

  const obstructed = whyObservation.createJeditWhyObservation({
    basisDigest: 'basis:obstructed',
    textAuthority: authority.obstructedWorkspaceTextAuthority(
      profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      '/repo/notes.md',
      44,
      runtimeIssue('read blocked'),
    ),
  });
  assert.equal(obstructed.evidence.posture, whyObservation.JeditWhyEvidencePostures.Obstructed);
  assert.equal(obstructed.evidence.obstruction.message, 'read blocked');

  const proofSources = whyObservation.createJeditWhyObservation({
    basisDigest: 'basis:proof',
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: '/repo/notes.md',
      bufferId: 'buffer:notes',
      readOnly: false,
      dirty: false,
      cache: windowReadingCache(),
    }),
    extraEvidenceSources: [
      {
        kind: whyObservation.JeditWhyEvidenceSourceKinds.EchoReadingEnvelope,
        posture: whyObservation.JeditWhyEvidencePostures.Available,
        referenceId: 'reading-envelope:echo',
      },
      {
        kind: whyObservation.JeditWhyEvidenceSourceKinds.TranslatedEvidence,
        posture: whyObservation.JeditWhyEvidencePostures.Available,
        referenceId: 'translated:git',
      },
      {
        kind: whyObservation.JeditWhyEvidenceSourceKinds.NativeEvidence,
        posture: whyObservation.JeditWhyEvidencePostures.Available,
        referenceId: 'native:echo',
      },
    ],
  });
  assert.equal(proofSources.evidence.nativeContinuumWitness, true);
  assert.ok(proofSources.evidence.sources.some(
    (source) => source.kind === whyObservation.JeditWhyEvidenceSourceKinds.EchoReadingEnvelope,
  ));
  assert.ok(proofSources.evidence.sources.some(
    (source) => source.kind === whyObservation.JeditWhyEvidenceSourceKinds.TranslatedEvidence,
  ));
  assert.ok(proofSources.evidence.sources.some(
    (source) => source.kind === whyObservation.JeditWhyEvidenceSourceKinds.NativeEvidence,
  ));
});

function hasEvidenceSource(observation, kind) {
  return observation.evidence.sources.some((source) => source.kind === kind);
}

function repeatWithTarget(basisDigest) {
  return {
    keys: ['d', 'w'],
    description: 'operatorMotion:delete:wordForward',
    replayPolicy: 'resolve-current-basis',
    sourceBasisDigest: basisDigest,
    target: {
      basisDigest,
      rangeStart: 0,
      rangeEnd: 6,
      shape: 'charwise',
    },
  };
}

function windowReadingCache() {
  return {
    bufferId: 'buffer:notes',
    readingId: 'reading:window',
    lines: ['gamma'],
    coverage: 'window',
    lineCount: 2,
    startLine: 1,
    returnedLineCount: 1,
    totalLineCount: 2,
    hasMoreBefore: true,
    hasMoreAfter: false,
    cursorLine: 1,
    viewportLineCount: 12,
    truncated: false,
  };
}

function runtimeIssue(message) {
  return {
    name: 'TestWhyObservationIssue',
    title: 'Why observation issue',
    message,
    level: 'error',
    source: 'command',
    atMs: 0,
  };
}
