// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { decode } from "cbor-x";

const [outputDirectory] = process.argv.slice(2);
assert.ok(outputDirectory, "pass the Edict application output directory");

const packageBytes = await readFile(
  path.join(outputDirectory, "executable-operation-package.cbor"),
);
const reportBytes = await readFile(
  path.join(outputDirectory, "verification-report.cbor"),
);
const executablePackage = decode(packageBytes);
const report = decode(reportBytes);
const program = decode(executablePackage.program);

assert.equal(executablePackage.schema, "echo.operation-package/v1");
assert.equal(
  executablePackage.package_kind,
  "compiler-produced-bounded-pure/v1",
);
assert.equal(
  executablePackage.operation_coordinate,
  "jedit.text.replace_range@1.replaceRange",
);
assert.equal(program.schema, "echo.compiler-produced-pure-program/v1");
assert.equal(program.kind, "compiler-produced-bounded-pure/v1");
assert.equal(program.intent, "replaceRange");
for (const artifact of [
  "core_artifact",
  "lawpack_exports_artifact",
  "result_projection_artifact",
  "target_ir_artifact",
]) {
  assert.ok(Buffer.isBuffer(program[artifact]), `${artifact} must be retained`);
  assert.ok(program[artifact].length > 0, `${artifact} must not be empty`);
}

assert.equal(
  report.apiVersion,
  "echo.operation-package-verifier-report/v1",
);
assert.equal(report.outcome, "accepted");
assert.equal(report.diagnosticBytes.length, 0);
assert.equal(
  report.applicationResultProjection.id,
  "jedit.text.replace_range@1.replaceRange",
);
