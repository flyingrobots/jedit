// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  realpath,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const applicationRoot = path.resolve(testsDirectory, "..");
const projectRoot = path.resolve(applicationRoot, "../..");
const lockPath = path.join(applicationRoot, "edict.toolchain-lock.json");
const edictRepository = process.env.EDICT_REPO;
const echoRepository = process.env.ECHO_REPO;

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    encoding: "utf8",
    env: process.env,
    input: options.input,
    timeout: options.timeout ?? 120_000,
  });
  if (options.emit !== false && result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (options.emit !== false && result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return result.stdout.trim();
}

function git(repository, ...arguments_) {
  return run("git", ["-C", repository, ...arguments_], { emit: false });
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function verifyGitCheckout(repository, expectedCommit, label) {
  assert.ok(repository, `${label} repository path is required`);
  const [requestedRoot, discoveredRoot] = await Promise.all([
    realpath(repository),
    realpath(git(repository, "rev-parse", "--show-toplevel")),
  ]);
  assert.equal(discoveredRoot, requestedRoot, `${label} path must be the checkout root`);
  assert.equal(git(repository, "rev-parse", "HEAD"), expectedCommit, `${label} commit mismatch`);
  assert.equal(
    git(repository, "status", "--porcelain=v1", "--untracked-files=all"),
    "",
    `${label} checkout must be clean`,
  );
}

function providerArtifact(manifest, role) {
  const matches = manifest.artifacts.filter((artifact) => artifact.role === role);
  assert.equal(matches.length, 1, `provider must contain one ${role} artifact`);
  return matches[0];
}

async function verifyProvider(lock) {
  const providerRoot = path.join(
    echoRepository,
    "schemas",
    "edict-provider",
    "package",
    "v1",
  );
  await rejectSymlinks(providerRoot);
  const manifestPath = path.join(providerRoot, "provider-manifest.echo.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.provider.coordinate, lock.coordinate);
  assert.equal(manifest.provider.digest, lock.digest);
  assert.equal(await sha256(manifestPath), lock.manifestSha256);

  for (const [role, fileName, expected] of [
    ["lowerer.echo-dpo", "lowerer.echo-dpo.component.wasm", lock.lowerer],
    ["verifier.echo-dpo", "verifier.echo-dpo.component.wasm", lock.verifier],
  ]) {
    const artifact = providerArtifact(manifest, role);
    assert.equal(artifact.resource.coordinate, expected.coordinate);
    assert.equal(artifact.resource.digest, `sha256:${expected.sha256}`);
    assert.equal(await sha256(path.join(providerRoot, "components", fileName)), expected.sha256);
  }
  return providerRoot;
}

async function rejectSymlinks(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `symbolic link is forbidden: ${entryPath}`);
    if (entry.isDirectory()) {
      await rejectSymlinks(entryPath);
    }
  }
}

async function collectDirectoryFiles(root, relative = "") {
  const files = [];
  const directory = path.join(root, relative);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (relative === "" && entry.name === ".build") {
      continue;
    }
    const entryRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectDirectoryFiles(root, entryRelative)));
    } else {
      files.push(entryRelative);
    }
  }
  return files;
}

function trackedFiles(repository) {
  return git(repository, "ls-files", "-z")
    .split("\0")
    .filter(Boolean)
    .sort();
}

async function snapshotFile(namespace, root, relative) {
  const filePath = path.join(root, relative);
  const metadata = await lstat(filePath, { bigint: true });
  const common = {
    path: `${namespace}/${relative.split(path.sep).join("/")}`,
    mode: metadata.mode.toString(),
    size: metadata.size.toString(),
    modifiedNanoseconds: metadata.mtimeNs.toString(),
    inode: metadata.ino.toString(),
  };
  if (metadata.isSymbolicLink()) {
    return { ...common, kind: "symlink", target: await readlink(filePath) };
  }
  if (metadata.isFile()) {
    return { ...common, kind: "file", sha256: await sha256(filePath) };
  }
  return { ...common, kind: "other" };
}

async function snapshotAuthoritativeInputs() {
  const roots = [
    ["jedit", applicationRoot, (await collectDirectoryFiles(applicationRoot)).sort()],
    ["edict", edictRepository, trackedFiles(edictRepository)],
    ["echo", echoRepository, trackedFiles(echoRepository)],
  ];
  const snapshot = [];
  for (const [namespace, root, files] of roots) {
    for (const relative of files) {
      snapshot.push(await snapshotFile(namespace, root, relative));
    }
  }
  return snapshot;
}

async function verifyVersions(lock) {
  assert.equal(run("rustc", [`+${lock.rust.toolchain}`, "--version"]), lock.rust.rustcVersion);
  assert.equal(run("cargo", [`+${lock.rust.toolchain}`, "--version"]), lock.rust.cargoVersion);
  run(
    "cargo",
    [`+${lock.rust.toolchain}`, "build", "--locked", "-p", "edict-cli"],
    { cwd: edictRepository },
  );
  const edictBinary = path.join(edictRepository, "target", "debug", "edict");
  const version = JSON.parse(run(edictBinary, ["--version"]));
  assert.equal(version.version, lock.edict.cliVersion);
  return edictBinary;
}

async function build() {
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  assert.equal(lock.schema, "jedit.edict-toolchain-lock/v1");
  await verifyGitCheckout(edictRepository, lock.edict.commit, "Edict");
  await verifyGitCheckout(echoRepository, lock.echo.commit, "Echo");
  const providerSource = await verifyProvider(lock.echo.provider);
  const before = await snapshotAuthoritativeInputs();
  let failure;
  try {
    const edictBinary = await verifyVersions(lock);
    run(edictBinary, [], {
      cwd: applicationRoot,
      input: `${JSON.stringify({
        schema: "edict.compiler.settings/v1",
        type: "compilerSettings",
        operation: "build",
        lawpack: "edict.lawpack.json",
        checkOnly: true,
      })}\n`,
    });

    const buildRoot = path.join(applicationRoot, ".build");
    const providerDestination = path.join(buildRoot, "echo-provider");
    const applicationOutput = path.join(buildRoot, "application");
    await rm(providerDestination, { recursive: true, force: true });
    await rm(applicationOutput, { recursive: true, force: true });
    await mkdir(providerDestination, { recursive: true });
    await cp(providerSource, providerDestination, { recursive: true });
    await rejectSymlinks(providerDestination);

    run(edictBinary, [], {
      cwd: applicationRoot,
      input: `${JSON.stringify({
        schema: "edict.compiler.settings/v1",
        type: "compilerSettings",
        operation: "build",
        application: "edict.application.json",
      })}\n`,
    });
    run(process.execPath, [path.join(testsDirectory, "assert-build-output.mjs"), applicationOutput], {
      cwd: applicationRoot,
    });
  } catch (error) {
    failure = error;
  }

  const after = await snapshotAuthoritativeInputs();
  let mutationFailure;
  try {
    assert.deepEqual(after, before, "authoritative inputs changed during package-chain build");
  } catch (error) {
    mutationFailure = error;
  }
  if (failure && mutationFailure) {
    throw new AggregateError([failure, mutationFailure], "build failed and authoritative inputs changed");
  }
  if (mutationFailure) {
    throw mutationFailure;
  }
  if (failure) {
    throw failure;
  }
}

await build();
