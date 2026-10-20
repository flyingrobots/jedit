"""Retain the real Buffer decimal helper's first public compiler boundary."""

import argparse
import json
from pathlib import Path
import runpy


COMPILER_COMMIT = "17397e2aad18a83ffc617d1afd628764501f49cd"
TRIVIAL_FUNCTION = b"fn retainFact(value: text.FactBytes) -> text.FactBytes { return value; }\n\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("compiler", "compiler-source", "compiler-manifest", "application-source",
                 "provider-package", "work-root"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    if not Path("/.dockerenv").is_file():
        raise RuntimeError("Run under shared git-locks admission and the guarded Docker lease")
    if not args.work_root.resolve().is_relative_to(Path("/tmp/echo-726-runtime")):
        raise RuntimeError("Work must stay inside the declared runtime-data accounting root")
    common = runpy.run_path(str(Path(__file__).parent.parent / "leaf-slice/run.py"))
    sha256, snapshot, verify = common["sha256"], common["snapshot"], common["verify_compiler_source"]
    compiler = verify(args.compiler_source, args.compiler_manifest, COMPILER_COMMIT)
    compiler["binarySha256"] = sha256(args.compiler)
    before = {"application": snapshot(args.application_source), "provider": snapshot(args.provider_package)}
    original = (args.application_source / "src/ReplaceRange.edict").read_bytes()
    authored = (Path(__file__).parent / "Decimal.edict").read_bytes()
    package, declarations = authored.split(b"\n", 1)
    if not original.startswith(package + b"\n") or b"type Input" not in original:
        raise RuntimeError("Expected the unchanged generic read control's source layout")
    sources = {
        "read-control": original,
        "fn-control": original.replace(b"type Input", TRIVIAL_FUNCTION + b"type Input", 1),
        "decimal": original.replace(b"type Input", declarations + b"\ntype Input", 1),
    }
    args.work_root.mkdir()
    evidence = {"compiler": compiler,
                "providerManifestSha256": sha256(args.provider_package / "provider-manifest.echo.json"),
                "providerFiles": before["provider"],
                "authoredSourceSha256": sha256(Path(__file__).parent / "Decimal.edict"),
                "literalCasesStatus": "not executed",
                "compositionStatus": "helpers are not connected to a retained-byte scanner",
                "results": {}}
    for name, source in sources.items():
        root = args.work_root / name
        common["prepare"](root, args.application_source, args.provider_package, source)
        evidence["results"][name] = common["build"](root, args.compiler)
    (args.work_root / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    for name, result in evidence["results"].items():
        print(json.dumps({"case": name, **result}, sort_keys=True), flush=True)
    if before != {"application": snapshot(args.application_source), "provider": snapshot(args.provider_package)}:
        raise RuntimeError("Public witness changed an authoritative input")
    if compiler["binarySha256"] != sha256(args.compiler):
        raise RuntimeError("Compiler binary changed during witness")
    verify(args.compiler_source, args.compiler_manifest, COMPILER_COMMIT)
    positive = evidence["results"]["read-control"]
    if (positive["exitCode"] != 0 or positive["diagnostics"] or positive["artifacts"] !=
            ["executable-operation-package.cbor", "verification-report.cbor"]):
        raise RuntimeError("Generic read control did not reach package/report success")
    for name in ("fn-control", "decimal"):
        negative = evidence["results"][name]
        if negative["exitCode"] != 2 or negative["artifacts"] or len(negative["diagnostics"]) != 1:
            raise RuntimeError(f"{name} did not refuse without application artifacts")
        diagnostic = negative["diagnostics"][0]
        if (diagnostic.get("kind") != "ApplicationCompilationFailed"
                or "expected `type`, `enum`, or `intent` declaration" not in diagnostic.get("message", "")
                or 'fn' not in diagnostic.get("message", "")):
            raise RuntimeError(f"{name} did not reach the source function parser boundary")
    print("JIM_BUFFER_DECIMAL_SOURCE_FUNCTION_BOUNDARY_CONFIRMED", flush=True)


if __name__ == "__main__":
    main()
