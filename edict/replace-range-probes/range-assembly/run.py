"""Exercise authored range-fragment assembly at Edict's public build boundary."""

import argparse
import json
from pathlib import Path
import runpy


COMPILER_COMMIT = "ac836e5c42a5c47b0dab30cfb0b09848cca73215"
SOURCE_EXPRESSION = b"input.firstFragment + input.secondFragment"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("compiler", "compiler-source", "compiler-manifest", "application-source",
                 "provider-package", "work-root"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    if not Path("/.dockerenv").is_file():
        raise RuntimeError("Run only under shared git-locks admission and the guarded Docker lease")
    if not args.work_root.resolve().is_relative_to(Path("/tmp/echo-726-runtime")):
        raise RuntimeError("Work must stay inside the declared runtime-data accounting root")
    # Reuse the existing public-build orchestration without changing its specimen or pins.
    common = runpy.run_path(str(Path(__file__).parent.parent / "leaf-slice/run.py"))
    sha256, snapshot = common["sha256"], common["snapshot"]
    verify = common["verify_compiler_source"]
    args.work_root.mkdir()
    compiler = verify(args.compiler_source, args.compiler_manifest, COMPILER_COMMIT)
    compiler["binarySha256"] = sha256(args.compiler)
    before = {"application": snapshot(args.application_source),
              "provider": snapshot(args.provider_package)}
    source = (Path(__file__).parent / "RangeAssembly.edict").read_bytes()
    if source.count(SOURCE_EXPRESSION) != 1:
        raise RuntimeError("Expected one exact authored fragment addition")
    sources = {
        "baseline": (args.application_source / "src/ReplaceRange.edict").read_bytes(),
        "first-control": source.replace(SOURCE_EXPRESSION, b"input.firstFragment"),
        "second-control": source.replace(SOURCE_EXPRESSION, b"input.secondFragment"),
        "assembly": source,
    }
    evidence = {"compiler": compiler,
                "providerManifestSha256": sha256(args.provider_package / "provider-manifest.echo.json"),
                "results": {}}
    for name, authored in sources.items():
        root = args.work_root / name
        common["prepare"](root, args.application_source, args.provider_package, authored)
        evidence["results"][name] = common["build"](root, args.compiler)
    (args.work_root / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    for name, result in evidence["results"].items():
        print(json.dumps({"case": name, **result}, sort_keys=True), flush=True)
    if before != {"application": snapshot(args.application_source),
                  "provider": snapshot(args.provider_package)}:
        raise RuntimeError("Witness changed an authoritative input")
    if compiler["binarySha256"] != sha256(args.compiler):
        raise RuntimeError("Compiler binary changed during witness")
    verify(args.compiler_source, args.compiler_manifest, COMPILER_COMMIT)
    for name in ("baseline", "first-control", "second-control"):
        result = evidence["results"][name]
        if result["exitCode"] != 0 or result["diagnostics"] or not result["artifacts"]:
            raise RuntimeError(f"{name} positive control did not build")
    result = evidence["results"]["assembly"]
    if result["exitCode"] != 2 or result["artifacts"]:
        raise RuntimeError("Assembly must refuse without application artifacts")
    refusal = result["diagnostics"]
    if (len(refusal) != 1 or refusal[0].get("kind") != "ApplicationCompilationFailed"
            or "string concatenation requires string operands" not in refusal[0].get("message", "")):
        raise RuntimeError("Assembly did not produce the expected source refusal")
    print("JIM_RANGE_ASSEMBLY_SOURCE_BOUNDARY_CONFIRMED", flush=True)


if __name__ == "__main__":
    main()
