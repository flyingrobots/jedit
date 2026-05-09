import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const BASELINE_PATH = 'quality-baseline.json';

async function main() {
  const auditProc = spawnSync('npx', ['eslint', 'src/**', '--format', 'json'], { encoding: 'utf8' });
  const audit = JSON.parse(auditProc.stdout || '[]');
  
  const baselineContent = await readFile(BASELINE_PATH, 'utf8');
  const baseline = JSON.parse(baselineContent);

  let currentErrors = 0;
  const currentFileErrors = {};

  for (const result of audit) {
    if (result.errorCount > 0) {
      currentErrors += result.errorCount;
      currentFileErrors[result.filePath.replace(process.cwd() + '/', '')] = result.errorCount;
    }
  }

  console.log(`Current quality state: ${currentErrors} errors (Baseline: ${baseline.totalErrors})`);

  if (currentErrors > baseline.totalErrors) {
    console.error(`🔴 Quality regression! Total errors increased from ${baseline.totalErrors} to ${currentErrors}.`);
    process.exit(1);
  }

  for (const [file, count] of Object.entries(currentFileErrors)) {
    if (!baseline.fileErrors[file] || count > baseline.fileErrors[file]) {
       console.error(`🔴 Quality regression in ${file}! Errors increased from ${baseline.fileErrors[file] || 0} to ${count}.`);
       process.exit(1);
    }
  }

  if (currentErrors < baseline.totalErrors) {
    console.log(`🟢 Quality improved! Ratcheting down from ${baseline.totalErrors} to ${currentErrors}.`);
    const nextBaseline = {
      totalErrors: currentErrors,
      fileErrors: currentFileErrors,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(BASELINE_PATH, JSON.stringify(nextBaseline, null, 2), 'utf8');
  } else {
    console.log('✅ Quality held steady. No regressions detected.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
