import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const INVENTORY_PATH = path.join(REPO_ROOT, 'docs', 'design', '0151-causal-rope-text-authority-inventory.md');
const REQUIRED_COVERAGE = Object.freeze([
  'Installed transport',
  'Workspace authority state',
  'Command handlers',
  'Save/export',
  'Source rendering',
  'Why command',
  'Tests and witnesses',
]);
const REQUIRED_CLASSIFICATIONS = Object.freeze([
  'causal rope authority',
  'materialized projection',
  'fixture',
  'migration/import',
  'forbidden',
]);
const REQUIRED_ISSUES = Object.freeze([
  '#217',
  '#218',
  '#222',
  '#247',
  '#249',
]);

test('causal rope text authority inventory covers required product surfaces', () => {
  const source = readFileSync(INVENTORY_PATH, 'utf8');

  for (const heading of REQUIRED_COVERAGE) {
    assert.match(source, new RegExp(`\\| ${escapeRegExp(heading)} \\|`, 'u'));
  }
});

test('causal rope text authority inventory defines every CR-00 classification', () => {
  const source = readFileSync(INVENTORY_PATH, 'utf8');

  for (const classification of REQUIRED_CLASSIFICATIONS) {
    assert.match(source, new RegExp(`\\*\\*${escapeRegExp(classification)}\\*\\*`, 'u'));
  }
});

test('causal rope text authority inventory links concrete follow-up blockers', () => {
  const source = readFileSync(INVENTORY_PATH, 'utf8');

  for (const issue of REQUIRED_ISSUES) {
    assert.match(source, new RegExp(escapeRegExp(issue), 'u'));
  }
});

test('causal rope text authority inventory states full materialized strings are not authority', () => {
  const source = readFileSync(INVENTORY_PATH, 'utf8');

  assert.match(source, /Full materialized strings are allowed only as import inputs/u);
  assert.match(source, /forbidden as product text authority/u);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
