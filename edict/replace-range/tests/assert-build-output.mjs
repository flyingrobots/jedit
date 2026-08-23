// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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

const SOURCE_CLOSURE_PATHS = [
  "edict.application.json",
  "edict.lawpack.json",
  "edict.toolchain-lock.json",
  "src/ReplaceRange.edict",
  "tests/assert-build-output.mjs",
  "tests/build.sh",
  "tests/package-chain.mjs",
  "tests/proof-harness.spec.mjs",
  "vendor/jedit-text/edict.lawpack-output.json",
  "vendor/jedit-text/exports.cbor",
  "vendor/jedit-text/exports.sha256",
  "vendor/jedit-text/manifest.cbor",
  "vendor/jedit-text/manifest.sha256",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest();
}

function lengthPrefix(length) {
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64LE(BigInt(length));
  return prefix;
}

async function sourceClosure(applicationRoot) {
  const hasher = createHash("sha256");
  hasher.update("jedit.edict-source-closure/v1\0");
  const files = [];
  for (const relative of SOURCE_CLOSURE_PATHS) {
    const bytes = await readFile(path.join(applicationRoot, relative));
    const relativeBytes = Buffer.from(relative, "utf8");
    hasher.update(lengthPrefix(relativeBytes.length));
    hasher.update(relativeBytes);
    hasher.update(lengthPrefix(bytes.length));
    hasher.update(bytes);
    files.push({ path: relative, sha256: sha256(bytes).toString("hex") });
  }
  return {
    schema: "jedit.edict-source-closure/v1",
    digest: `sha256:${hasher.digest("hex")}`,
    files,
  };
}

function digestText(bytes) {
  return `sha256:${Buffer.from(bytes).toString("hex")}`;
}

const [outputDirectory, mode] = process.argv.slice(2);
assert.ok(outputDirectory, "pass the Edict application output directory");
assert.ok(
  mode === undefined || mode === "--write-locks",
  "the only supported mode is --write-locks",
);
const applicationRoot = path.resolve(outputDirectory, "../..");

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
const coreArtifact = decode(program.core_artifact);
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

const toolchainLockBytes = await readFile(
  path.join(applicationRoot, "edict.toolchain-lock.json"),
);
const toolchainLock = JSON.parse(toolchainLockBytes);
const lawpackReleaseDigest = (
  await readFile(
    path.join(applicationRoot, "vendor", "jedit-text", "manifest.sha256"),
    "utf8",
  )
).trim();
const reportDigest = canonicalArtifactDigest(
  "echo.operation-package-verifier-report/v1",
  reportBytes,
);
const computedBuildLock = {
  schema: "jedit.edict-build-lock/v1",
  applicationCoordinate: coreArtifact.coordinate,
  operationCoordinate: executablePackage.operation_coordinate,
  toolchainLockSha256: sha256(toolchainLockBytes).toString("hex"),
  sourceClosure: await sourceClosure(applicationRoot),
  lawpackRelease: {
    coordinate: executablePackage.semantic_closure.lawpack_coordinate,
    digest: lawpackReleaseDigest,
  },
  provider: {
    coordinate: toolchainLock.echo.provider.coordinate,
    digest: toolchainLock.echo.provider.digest,
  },
  artifacts: {
    core: {
      coordinate: coreArtifact.coordinate,
      domain: "edict.core.module/v1",
      digest: digestText(coreDigest),
    },
    targetIr: {
      coordinate: report.targetIr.id,
      domain: "edict.target-ir.artifact/v1",
      digest: digestText(targetIrDigest),
    },
    resultProjection: {
      coordinate: report.applicationResultProjection.id,
      domain: "edict.result-projection.artifact/v1",
      digest: digestText(resultProjectionDigest),
    },
    executablePackage: {
      coordinate: report.package.id,
      domain: "echo.operation-package/v1",
      digest: digestText(packageDigest),
      rawSha256: sha256(packageBytes).toString("hex"),
    },
    verificationReport: {
      coordinate: "verifier-report.echo-operation",
      domain: "echo.operation-package-verifier-report/v1",
      digest: digestText(reportDigest),
      rawSha256: sha256(reportBytes).toString("hex"),
    },
    executableSubject: {
      coordinate: report.executableSubject.reference.id,
      domain: "echo.executable-subject/v1",
      digest: digestText(executableSubjectDigest),
    },
  },
};
const computedSubjectLock = {
  schema: "jedit.edict-executable-subject-lock/v1",
  reference: {
    coordinate: report.executableSubject.reference.id,
    digest: digestText(executableSubjectDigest),
  },
  rawSha256: sha256(report.executableSubject.bytes).toString("hex"),
  package: {
    coordinate: report.package.id,
    digest: digestText(packageDigest),
  },
  targetIr: {
    coordinate: report.targetIr.id,
    digest: digestText(targetIrDigest),
  },
  resultProjection: {
    coordinate: report.applicationResultProjection.id,
    digest: digestText(resultProjectionDigest),
  },
};

const buildLockPath = path.join(applicationRoot, "edict.build-lock.json");
const subjectLockPath = path.join(
  applicationRoot,
  "edict.executable-subject-lock.json",
);
if (mode === "--write-locks") {
  await writeFile(buildLockPath, `${JSON.stringify(computedBuildLock, null, 2)}\n`);
  await writeFile(subjectLockPath, `${JSON.stringify(computedSubjectLock, null, 2)}\n`);
} else {
  assert.deepEqual(
    JSON.parse(await readFile(buildLockPath, "utf8")),
    computedBuildLock,
    "the exact build closure differs from edict.build-lock.json",
  );
  assert.deepEqual(
    JSON.parse(await readFile(subjectLockPath, "utf8")),
    computedSubjectLock,
    "the executable subject differs from edict.executable-subject-lock.json",
  );
}
