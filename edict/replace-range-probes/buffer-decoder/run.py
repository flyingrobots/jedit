"""Reproduce the distinct function-parser and decimal-lexer boundaries."""

import argparse
import json
from pathlib import Path
import runpy


COMPILER_COMMIT = "17397e2aad18a83ffc617d1afd628764501f49cd"
HISTORICAL_COMPILER_SHA256 = "e2700698829b03f437c66425ed9878b002ef7a34ac183a39bac4eaf6a758cc6d"
TRIVIAL_FUNCTION = b"fn retainFact(value: text.FactBytes) -> text.FactBytes { return value; }\n\n"


def compiler_digest(value):
    if len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
        raise argparse.ArgumentTypeError("compiler SHA-256 must be 64 lowercase hexadecimal digits")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("compiler", "compiler-source", "compiler-manifest", "application-source",
                 "provider-package", "work-root"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--compiler-sha256", type=compiler_digest,
                        default=HISTORICAL_COMPILER_SHA256,
                        help="explicit binary pin from the controlled compiler build; defaults to the historical binary")
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
    expected = json.loads((Path(__file__).parent / "evidence/original/public-build.json").read_text())
    expected_compiler = dict(expected["compiler"], binarySha256=args.compiler_sha256)
    if compiler != expected_compiler:
        raise RuntimeError("Compiler source or explicitly pinned binary identity differs")
    if before["provider"] != expected["providerFiles"]:
        raise RuntimeError("Provider bytes differ from the retained public witness")
    if sha256(Path(__file__).parent / "Decimal.edict") != expected["authoredSourceSha256"]:
        raise RuntimeError("Authored source differs from the retained public witness")
    if sha256(args.application_source / "src/ReplaceRange.edict") != expected["results"]["read-control"]["sourceSha256"]:
        raise RuntimeError("Read control differs from the retained public witness")
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
    expected_messages = {
        "fn-control": ("kind: ExpectedToken", "expected `type`, `enum`, or `intent` declaration", "fn"),
        "decimal": ("kind: Lex", "invalid string escape"),
    }
    for name, markers in expected_messages.items():
        negative = evidence["results"][name]
        if negative["exitCode"] != 2 or negative["artifacts"] or len(negative["diagnostics"]) != 1:
            raise RuntimeError(f"{name} did not refuse without application artifacts")
        diagnostic = negative["diagnostics"][0]
        if (diagnostic.get("kind") != "InvalidApplicationSource"
                or any(marker not in diagnostic.get("message", "") for marker in markers)):
            raise RuntimeError(f"{name} did not reach its retained source boundary")
    print("JIM_BUFFER_DECIMAL_DISTINCT_SOURCE_BOUNDARIES_CONFIRMED", flush=True)


if __name__ == "__main__":
    main()
