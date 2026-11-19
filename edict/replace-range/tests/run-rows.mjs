// The 40-row runner (#296): writes every runtime case, runs the Rust row
// runner against a locked ReplaceRange package on Echo's public
// EffectPackageHost, and judges each observation under the #296 read-set
// ruling. Usage:
//   node edict/replace-range/tests/run-rows.mjs <package.cbor> <package pin hex> <work dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unmetReasons } from '../../../tests/support/replace-range-schema-2/judge.mjs';
import { ropeReadBounds } from './rope-lawpack.mjs';
import { runtimeCases } from './runtime-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, '..', 'rope', 'runtime');
const FIXTURES = path.join(HERE, '..', '..', '..', 'contracts', 'jedit', 'acceptance', 'replace-range-schema-2',
  'replace-range-schema-2.fixtures.json');
const COMMITTED = 'committed';
const OBSTRUCTED = 'obstructed';

function casesDocument() {
  const { profile } = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  const edgeTypeNames = Object.fromEntries(Object.entries(profile.edgeTypes).map(([name, { id }]) => [id, name]));
  const edgeTypeIds = Object.keys(edgeTypeNames).sort();
  return runtimeCases().map((entry) => ({ ...entry, edgeTypeIds, edgeTypeNames }));
}

// The judge's observation for one runner record. Fields the runner cannot
// observe yet stay absent, so the judge reports them instead of passing them.
function judged(record) {
  if (record.executed !== true) return { target: 'persistent-rope', executed: false };
  const committed = /^[0-9a-f]+$/.test(record.output);
  return {
    target: 'persistent-rope', executed: true, posture: committed ? COMMITTED : OBSTRUCTED,
    effects: record.effects, readSet: record.readSet, closureDepth: 0,
  };
}

function main() {
  const [packagePath, pin, workDirectory] = process.argv.slice(2);
  if (workDirectory === undefined) throw new Error('usage: run-rows.mjs <package.cbor> <pin hex> <work dir>');
  mkdirSync(workDirectory, { recursive: true });
  const casesPath = path.join(workDirectory, 'cases.json');
  const observationsPath = path.join(workDirectory, 'observations.json');
  const cases = casesDocument();
  writeFileSync(casesPath, JSON.stringify(cases));
  execFileSync('cargo', ['test', '--test', 'rows', '--', '--ignored', '--nocapture'], {
    cwd: RUNTIME, stdio: 'inherit',
    env: { ...process.env, JEDIT_ROPE_PACKAGE: path.resolve(packagePath), JEDIT_ROPE_PACKAGE_PIN: pin,
      JEDIT_ROPE_CASES: casesPath, JEDIT_ROPE_OBSERVATIONS: observationsPath },
  });
  const observations = new Map(JSON.parse(readFileSync(observationsPath, 'utf8')).map((record) => [record.id, record]));
  let passing = 0;
  for (const entry of cases) {
    const reasons = unmetReasons(entry.row, judged(observations.get(entry.id)), ropeReadBounds);
    if (reasons.length === 0) passing += 1;
    process.stdout.write(`${reasons.length === 0 ? 'PASS' : 'GAP '} ${entry.id}${reasons.length === 0 ? '' : `: ${reasons.join('; ')}`}\n`);
  }
  const retained = cases.filter((entry) => entry.retained && unmetReasons(entry.row,
    judged(observations.get(entry.id)), ropeReadBounds).length === 0).length;
  process.stdout.write(`retained passing: ${retained}/40; all passing: ${passing}/${cases.length}\n`);
}

main();
