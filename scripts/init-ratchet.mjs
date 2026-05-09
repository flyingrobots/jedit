import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const BASELINE_PATH = 'quality-baseline.json';
const AUDIT_PATH = 'quality-audit.json';

async function main() {
  const auditContent = await readFile(AUDIT_PATH, 'utf8');
  const audit = JSON.parse(auditContent);
  
  let totalErrors = 0;
  const fileErrors = {};

  for (const result of audit) {
    if (result.errorCount > 0) {
      totalErrors += result.errorCount;
      fileErrors[result.filePath.replace(process.cwd() + '/', '')] = result.errorCount;
    }
  }

  const baseline = {
    totalErrors,
    fileErrors,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2), 'utf8');
  console.log(`Quality ratchet initialized at ${totalErrors} errors.`);
}

main().catch(console.error);
