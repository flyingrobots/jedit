// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { decode, encode } from "cbor-x";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const applicationRoot = path.resolve(testDirectory, "..");
const projectRoot = path.resolve(applicationRoot, "../..");
const edictRepository = process.env.EDICT_REPO;
const echoRepository = process.env.ECHO_REPO;

function requireToolchainEnvironment() {
  assert.ok(edictRepository, "EDICT_REPO must name the exact Edict checkout");
  assert.ok(echoRepository, "ECHO_REPO must name the exact Echo checkout");
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "jedit-replace-range-proof-"));
  const fixtureProject = path.join(root, "jedit");
  const fixtureApplication = path.join(fixtureProject, "edict", "replace-range");
  await mkdir(path.dirname(fixtureApplication), { recursive: true });
  await cp(applicationRoot, fixtureApplication, { recursive: true });
  await symlink(path.join(projectRoot, "node_modules"), path.join(fixtureProject, "node_modules"), "dir");
  return {
    root,
    project: fixtureProject,
    application: fixtureApplication,
    async dispose() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

function runBuild(fixtureProject, overrides = {}) {
  return spawnSync("bash", ["edict/replace-range/tests/build.sh"], {
    cwd: fixtureProject,
    encoding: "utf8",
    env: {
      ...process.env,
      EDICT_REPO: edictRepository,
      ECHO_REPO: echoRepository,
      ...overrides,
    },
    timeout: 120_000,
  });
}

function assertCommandCompleted(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.notEqual(result.status, null, `command terminated by ${result.signal}`);
}

test("rejects_non_git_or_wrong_commit_toolchain_inputs", { timeout: 120_000 }, async () => {
  requireToolchainEnvironment();
  const subject = await fixture();
  try {
    const fakeEdict = path.join(subject.root, "fake-edict");
    const fakeEcho = path.join(subject.root, "fake-echo");
    const fakeEdictBinary = path.join(fakeEdict, "target", "debug", "edict");
    const providerSource = path.join(
      echoRepository,
      "schemas",
      "edict-provider",
      "package",
      "v1",
    );
    const fakeProvider = path.join(
      fakeEcho,
      "schemas",
      "edict-provider",
      "package",
      "v1",
    );
    await mkdir(path.dirname(fakeEdictBinary), { recursive: true });
    await mkdir(path.dirname(fakeProvider), { recursive: true });
    await symlink(path.join(edictRepository, "target", "debug", "edict"), fakeEdictBinary);
    await cp(providerSource, fakeProvider, { recursive: true });

    const result = runBuild(subject.project, {
      EDICT_REPO: fakeEdict,
      ECHO_REPO: fakeEcho,
    });
    assertCommandCompleted(result);
    assert.notEqual(
      result.status,
      0,
      "non-Git toolchain directories must be rejected before publication or application build",
    );
  } finally {
    await subject.dispose();
  }
});

test("lawpack_check_only_rejects_drift_without_repairing_it", { timeout: 120_000 }, async () => {
  requireToolchainEnvironment();
  const subject = await fixture();
  try {
    const digestPath = path.join(
      subject.application,
      "vendor",
      "jedit-text",
      "manifest.sha256",
    );
    const corruptDigest = `sha256:${"0".repeat(64)}\n`;
    await writeFile(digestPath, corruptDigest);

    const result = runBuild(subject.project);
    assertCommandCompleted(result);
    assert.notEqual(result.status, 0, "drift must fail instead of being repaired");
    assert.equal(
      await readFile(digestPath, "utf8"),
      corruptDigest,
      "check-only validation must leave the drifted artifact untouched",
    );
  } finally {
    await subject.dispose();
  }
});

test(
  "rejects_package_whose_recomputed_identity_differs_from_report_subject",
  { timeout: 120_000 },
  async () => {
    requireToolchainEnvironment();
    const subject = await fixture();
    try {
      const build = runBuild(subject.project);
      assertCommandCompleted(build);
      assert.equal(build.status, 0, build.stderr);

      const outputDirectory = path.join(subject.application, ".build", "application");
      const packagePath = path.join(outputDirectory, "executable-operation-package.cbor");
      const executablePackage = decode(await readFile(packagePath));
      const program = decode(executablePackage.program);
      const alteredCore = Buffer.from(program.core_artifact);
      alteredCore[0] ^= 1;
      program.core_artifact = alteredCore;
      executablePackage.program = encode(program);
      await writeFile(packagePath, encode(executablePackage));

      const assertion = spawnSync(
        process.execPath,
        [path.join(subject.application, "tests", "assert-build-output.mjs"), outputDirectory],
        { cwd: subject.project, encoding: "utf8", timeout: 30_000 },
      );
      assertCommandCompleted(assertion);
      assert.notEqual(
        assertion.status,
        0,
        "a report for the original package must not authorize altered embedded Core bytes",
      );
    } finally {
      await subject.dispose();
    }
  },
);

test("rejects_short_buffer_and_head_identities", { timeout: 120_000 }, async () => {
  requireToolchainEnvironment();
  const subject = await fixture();
  try {
    const build = runBuild(subject.project);
    assertCommandCompleted(build);
    assert.equal(build.status, 0, build.stderr);

    const packageBytes = await readFile(
      path.join(subject.application, ".build", "application", "executable-operation-package.cbor"),
    );
    const executablePackage = decode(packageBytes);
    const program = decode(executablePackage.program);
    const core = decode(program.core_artifact);
    for (const typeName of [
      "ReplaceRangeInput.bufferId",
      "ReplaceRangeInput.basisHeadId",
      "ReplaceRangeBoundary.bufferId",
      "ReplaceRangeBoundary.basisHeadId",
    ]) {
      assert.deepEqual(
        core.types[typeName],
        { kind: "Bytes", min: 32, max: 32 },
        `${typeName} must preserve the exact 32-byte identity contract in Core`,
      );
    }
  } finally {
    await subject.dispose();
  }
});

test("rejects_drifted_build_and_executable_subject_locks", { timeout: 120_000 }, async () => {
  requireToolchainEnvironment();
  const subject = await fixture();
  try {
    const lockPath = path.join(subject.application, "edict.build-lock.json");
    const lock = JSON.parse(await readFile(lockPath, "utf8"));
    lock.artifacts.core.digest = `sha256:${"0".repeat(64)}`;
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

    const build = runBuild(subject.project);
    assertCommandCompleted(build);
    assert.notEqual(
      build.status,
      0,
      "a changed exact-artifact expectation must fail the package-chain gate",
    );
  } finally {
    await subject.dispose();
  }
});

test("required_ci_executes_the_exact_package_chain", async () => {
  const workflow = await readFile(
    path.join(projectRoot, ".github", "workflows", "ci.yml"),
    "utf8",
  );
  assert.match(workflow, /^  edict-replace-range:\n/m);
  assert.match(workflow, /name: edict \/ replace-range package chain/);
  assert.match(
    workflow,
    /node --test edict\/replace-range\/tests\/proof-harness\.spec\.mjs/,
  );
  assert.match(
    workflow,
    /needs: \[ plan, build, test-shards, quality, release-gate, edict-replace-range \]/,
  );
});
