import assert from 'node:assert/strict';
import test from 'node:test';

import { importDist } from './dist-helpers.mjs';

test('Normal state accumulates an operator-pending chord without execution readiness', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const transition = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: 'd' },
  );

  assert.equal(transition.effect, normal.VimNormalTransitionEffects.Pending);
  assert.equal(transition.readyForExecution, false);
  assert.equal(transition.state.phase, normal.VimNormalPhases.OperatorPending);
  assert.deepEqual(transition.state.pendingKeys, ['d']);
  assert.equal(transition.syntax.operator, 'delete');
});

test('Operator-pending state completes when a motion arrives', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const pending = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: 'd' },
  );
  const complete = normal.updateVimNormalAccumulator(
    pending.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'w' },
  );

  assert.equal(complete.effect, normal.VimNormalTransitionEffects.Complete);
  assert.equal(complete.readyForExecution, true);
  assert.equal(complete.state.phase, normal.VimNormalPhases.Normal);
  assert.deepEqual(complete.state.pendingKeys, []);
  assert.equal(complete.syntax.family, 'operatorMotion');
  assert.equal(complete.syntax.motion, 'wordForward');
});

test('Operator-pending state keeps text-object scopes pending', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const pending = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: 'd' },
  );
  const scope = normal.updateVimNormalAccumulator(
    pending.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'a' },
  );
  const complete = normal.updateVimNormalAccumulator(
    scope.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'w' },
  );

  assert.equal(scope.effect, normal.VimNormalTransitionEffects.Pending);
  assert.equal(scope.readyForExecution, false);
  assert.equal(scope.state.phase, normal.VimNormalPhases.OperatorPending);
  assert.deepEqual(scope.state.pendingKeys, ['d', 'a']);
  assert.equal(complete.effect, normal.VimNormalTransitionEffects.Complete);
  assert.equal(complete.syntax.family, 'operatorTextObject');
  assert.deepEqual(complete.syntax.textObject, { scope: 'around', target: 'word' });
});

test('Escape resets pending Normal state without execution readiness', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const pending = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: 'g' },
  );
  const reset = normal.updateVimNormalAccumulator(
    pending.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'escape' },
  );

  assert.equal(reset.effect, normal.VimNormalTransitionEffects.Reset);
  assert.equal(reset.readyForExecution, false);
  assert.equal(reset.state.phase, normal.VimNormalPhases.Normal);
  assert.deepEqual(reset.state.pendingKeys, []);
});

test('Counts remain syntax-only until the command completes', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const count = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: '2' },
  );
  const operator = normal.updateVimNormalAccumulator(
    count.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'd' },
  );
  const complete = normal.updateVimNormalAccumulator(
    operator.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'w' },
  );

  assert.equal(count.readyForExecution, false);
  assert.equal(count.state.phase, normal.VimNormalPhases.ModifierPending);
  assert.equal(operator.readyForExecution, false);
  assert.equal(operator.state.phase, normal.VimNormalPhases.OperatorPending);
  assert.equal(complete.readyForExecution, true);
  assert.equal(complete.syntax.count, 2);
});

test('Registers remain syntax-only until the command completes', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const prefix = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: '"' },
  );
  const register = normal.updateVimNormalAccumulator(
    prefix.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'a' },
  );
  const operator = normal.updateVimNormalAccumulator(
    register.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'y' },
  );
  const complete = normal.updateVimNormalAccumulator(
    operator.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'y' },
  );

  assert.equal(prefix.state.phase, normal.VimNormalPhases.PrefixPending);
  assert.equal(register.state.phase, normal.VimNormalPhases.ModifierPending);
  assert.equal(operator.state.phase, normal.VimNormalPhases.OperatorPending);
  assert.equal(complete.readyForExecution, true);
  assert.equal(complete.syntax.register, 'a');
  assert.equal(complete.syntax.operator, 'yank');
});

test('Command-line input remains pending until Enter accepts it', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const invocation = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: ':' },
  );
  const write = normal.updateVimNormalAccumulator(
    invocation.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'w' },
  );
  const quit = normal.updateVimNormalAccumulator(
    write.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'q' },
  );
  const accepted = normal.updateVimNormalAccumulator(
    quit.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'enter' },
  );

  assert.equal(write.effect, normal.VimNormalTransitionEffects.Pending);
  assert.equal(write.syntax.commandLine.text, 'w');
  assert.equal(quit.effect, normal.VimNormalTransitionEffects.Pending);
  assert.equal(quit.syntax.commandLine.text, 'wq');
  assert.equal(accepted.effect, normal.VimNormalTransitionEffects.Complete);
  assert.equal(accepted.readyForExecution, true);
  assert.deepEqual(accepted.syntax.commandLine, { text: 'wq' });
});

test('Invalid continuations reset pending state without execution readiness', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const pending = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: 'd' },
  );
  const invalid = normal.updateVimNormalAccumulator(
    pending.state,
    { owner: normal.VimNormalInputOwners.Normal, key: 'f2' },
  );

  assert.equal(invalid.effect, normal.VimNormalTransitionEffects.Invalid);
  assert.equal(invalid.readyForExecution, false);
  assert.equal(invalid.state.phase, normal.VimNormalPhases.Normal);
  assert.deepEqual(invalid.state.pendingKeys, []);
  assert.equal(invalid.syntax.obstruction, 'unexpectedOperatorTarget');
});

test('Command-line, modal, drawer, insert, and focus owners keep pending state inert', async () => {
  const normal = await importDist('app', 'workspace', 'vim-normal-state.js');
  const pending = normal.updateVimNormalAccumulator(
    normal.createVimNormalAccumulator(),
    { owner: normal.VimNormalInputOwners.Normal, key: 'd' },
  );

  assertIgnoredOwner(normal, pending.state, normal.VimNormalInputOwners.CommandLine, normal.VimNormalIgnoredReasons.OwnedByCommandLine);
  assertIgnoredOwner(normal, pending.state, normal.VimNormalInputOwners.Modal, normal.VimNormalIgnoredReasons.OwnedByModal);
  assertIgnoredOwner(normal, pending.state, normal.VimNormalInputOwners.Drawer, normal.VimNormalIgnoredReasons.OwnedByDrawer);
  assertIgnoredOwner(normal, pending.state, normal.VimNormalInputOwners.Insert, normal.VimNormalIgnoredReasons.OwnedByInsert);
  assertIgnoredOwner(normal, pending.state, normal.VimNormalInputOwners.FocusTransfer, normal.VimNormalIgnoredReasons.OwnedByFocusTransfer);
});

function assertIgnoredOwner(normal, state, owner, reason) {
  const transition = normal.updateVimNormalAccumulator(state, { owner, key: 'w' });

  assert.equal(transition.effect, normal.VimNormalTransitionEffects.Ignored);
  assert.equal(transition.readyForExecution, false);
  assert.equal(transition.ignoredReason, reason);
  assert.deepEqual(transition.state, state);
}
