"""Exercise authored byte slicing at the public compiler build boundary."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


COMPILER_COMMIT = "2405a550e93e1e97fff640caa44bbd0f65ffff3c"
CANDIDATE_COMPILER_COMMIT = "0835f398336ce1c693b5531b262228cd909c0b4b"
SOURCE_EXPRESSION = "slice(input.blobBytes, input.startByte, input.endByte)"
MAX_LOG_BYTES = 1024 * 1024


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(root):
    return {str(path.relative_to(root)): sha256(path)
            for path in sorted(root.rglob("*")) if path.is_file()}


def verify_compiler_source(root, manifest_path, expected_commit):
    manifest = json.loads(manifest_path.read_text())
    if manifest["commit"] != expected_commit:
        raise RuntimeError("The witness requires its explicit experimental compiler pin")
    for entry in manifest["files"]:
        relative = Path(entry["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise RuntimeError("Compiler source manifest contains an unsafe path")
        data = (root / relative).read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        if blob != entry["gitBlob"]:
            raise RuntimeError(f"Compiler source differs at {relative}")
    return {"commit": manifest["commit"], "tree": manifest["tree"],
            "fileCount": len(manifest["files"]),
            "manifestSha256": sha256(manifest_path)}


def prepare(root, application_source, provider_source, source):
    root.mkdir()
    shutil.copy2(application_source / "edict.application.json", root)
    shutil.copytree(application_source / "vendor", root / "vendor")
    (root / "src").mkdir()
    (root / "src/ReplaceRange.edict").write_bytes(source)
    shutil.copytree(provider_source, root / ".build/echo-provider")


def build(root, compiler):
    request = {"schema": "edict.compiler.settings/v1", "type": "compilerSettings",
               "operation": "build", "application": "edict.application.json"}
    stdout_path, stderr_path = root / "stdout.jsonl", root / "stderr.jsonl"
    with stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
        result = subprocess.run([str(compiler)], cwd=root,
                                input=(json.dumps(request) + "\n").encode(),
                                stdout=stdout, stderr=stderr, timeout=120, check=False)
    events = []
    for path in (stdout_path, stderr_path):
        if path.stat().st_size > MAX_LOG_BYTES:
            raise RuntimeError("Compiler output exceeded witness log ceiling")
        events.extend(json.loads(line) for line in path.read_text().splitlines())
    statuses = [event for event in events if event.get("type") == "status"]
    if len(statuses) != 1 or statuses[0].get("exitCode") != result.returncode:
        raise RuntimeError(f"Invalid compiler status stream: {events}")
    diagnostics = [event for event in events if event.get("type") == "diagnostic"]
    output = root / ".build/application"
    artifacts = sorted(str(path.relative_to(output)) for path in output.rglob("*")
                       if path.is_file()) if output.exists() else []
    return {"exitCode": result.returncode, "diagnostics": diagnostics,
            "artifacts": artifacts, "sourceSha256": sha256(root / "src/ReplaceRange.edict"),
            "artifactSha256": {name: sha256(output / name) for name in artifacts},
            "stdoutSha256": sha256(stdout_path), "stderrSha256": sha256(stderr_path)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("compiler", "compiler-source", "compiler-manifest", "application-source",
                 "provider-package", "work-root"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--boundary", choices=("source", "package"), default="source")
    args = parser.parse_args()
    if not Path("/.dockerenv").is_file():
        raise RuntimeError("Run only under the shared guarded Docker-worker lease")
    if not args.work_root.resolve().is_relative_to(Path("/tmp/echo-726-runtime")):
        raise RuntimeError("Work must stay inside the declared runtime-data accounting root")
    args.work_root.mkdir()
    expected_commit = COMPILER_COMMIT if args.boundary == "source" else CANDIDATE_COMPILER_COMMIT
    compiler_identity = verify_compiler_source(args.compiler_source, args.compiler_manifest,
                                               expected_commit)
    compiler_identity["binarySha256"] = sha256(args.compiler)
    before = {"application": snapshot(args.application_source),
              "provider": snapshot(args.provider_package)}
    source = (Path(__file__).parent / "LeafSlice.edict").read_bytes()
    if source.count(SOURCE_EXPRESSION.encode()) != 1:
        raise RuntimeError("Expected one exact authored slice expression")
    sources = {
        "baseline": (args.application_source / "src/ReplaceRange.edict").read_bytes(),
        "guard-control": source.replace(SOURCE_EXPRESSION.encode(), b"input.blobBytes"),
        "slice": source,
    }
    evidence = {"compiler": compiler_identity,
                "providerManifestSha256": sha256(args.provider_package / "provider-manifest.echo.json"),
                "results": {}}
    for name, authored in sources.items():
        root = args.work_root / name
        prepare(root, args.application_source, args.provider_package, authored)
        evidence["results"][name] = build(root, args.compiler)
    (args.work_root / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    for name, result in evidence["results"].items():
        print(json.dumps({"case": name, **result}, sort_keys=True), flush=True)
    if before != {"application": snapshot(args.application_source),
                  "provider": snapshot(args.provider_package)}:
        raise RuntimeError("Witness changed an authoritative input")
    if compiler_identity["binarySha256"] != sha256(args.compiler):
        raise RuntimeError("Compiler binary changed during the witness")
    verify_compiler_source(args.compiler_source, args.compiler_manifest, expected_commit)
    for name in ("baseline", "guard-control"):
        result = evidence["results"][name]
        if result["exitCode"] != 0 or result["diagnostics"] or not result["artifacts"]:
            raise RuntimeError(f"{name} positive control did not build")
    result = evidence["results"]["slice"]
    if args.boundary == "package":
        if (result["exitCode"] != 0 or result["diagnostics"]
                or result["artifacts"] != ["executable-operation-package.cbor", "verification-report.cbor"]):
            raise RuntimeError("Slice did not reach the expected package build boundary")
        print("JIM_LEAF_SLICE_PACKAGE_BOUNDARY_CONFIRMED", flush=True)
        return
    if result["exitCode"] != 2 or result["artifacts"]:
        raise RuntimeError("Slice must refuse without application artifacts")
    refusal = evidence["results"]["slice"]["diagnostics"]
    if (len(refusal) != 1 or refusal[0].get("kind") != "ApplicationCompilationFailed"
            or "pure helper `slice` has no compiler context fact" not in refusal[0].get("message", "")):
        raise RuntimeError("Slice did not produce the expected source refusal")
    print("JIM_LEAF_SLICE_SOURCE_BOUNDARY_CONFIRMED", flush=True)


if __name__ == "__main__":
    main()
