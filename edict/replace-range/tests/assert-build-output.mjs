// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { decode, encode } from "cbor-x";

function canonicalArtifactDigest(domain, canonicalArtifactBytes) {
  const preimage = Buffer.concat([
    Buffer.from([0x83]),
    Buffer.from(encode("edict.digest/v1")),
    Buffer.from(encode(domain)),
    Buffer.from(canonicalArtifactBytes),
  ]);
  return createHash("sha256").update(preimage).digest();
}

function assertResourceReference(reference, coordinate, digest) {
  assert.equal(reference.id, coordinate);
  assert.deepEqual(reference.digest, ["sha256", digest]);
}

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

const packageDigest = canonicalArtifactDigest(
  "echo.operation-package/v1",
  packageBytes,
);
assertResourceReference(
  report.package,
  "executable-operation-package.echo",
  packageDigest,
);

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

const coreDigest = canonicalArtifactDigest(
  "edict.core.module/v1",
  program.core_artifact,
);
assert.deepEqual(executablePackage.semantic_closure.core_identity, coreDigest);
assert.deepEqual(
  executablePackage.semantic_closure.canonical_meaning_identity,
  coreDigest,
);

const targetIrDigest = canonicalArtifactDigest(
  "edict.target-ir.artifact/v1",
  program.target_ir_artifact,
);
assert.deepEqual(
  executablePackage.semantic_closure.target_ir_identity,
  targetIrDigest,
);
assertResourceReference(report.targetIr, "echo.span-ir/v1", targetIrDigest);

const resultProjectionDigest = canonicalArtifactDigest(
  "edict.result-projection.artifact/v1",
  program.result_projection_artifact,
);

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
assertResourceReference(
  report.applicationResultProjection,
  "jedit.text.replace_range@1.replaceRange",
  resultProjectionDigest,
);

assert.equal(
  report.executableSubject.reference.id,
  "echo.executable-subject/v1",
);
assert.ok(
  Buffer.isBuffer(report.executableSubject.bytes),
  "the verifier report must retain the executable subject bytes",
);
const executableSubjectDigest = canonicalArtifactDigest(
  "echo.executable-subject/v1",
  report.executableSubject.bytes,
);
assertResourceReference(
  report.executableSubject.reference,
  "echo.executable-subject/v1",
  executableSubjectDigest,
);
const executableSubject = decode(report.executableSubject.bytes);
assert.equal(executableSubject.apiVersion, "echo.executable-subject/v1");
assert.deepEqual(executableSubject.package, report.package);
assert.deepEqual(executableSubject.targetIr, report.targetIr);
assert.deepEqual(
  executableSubject.applicationResultProjection,
  report.applicationResultProjection,
);
