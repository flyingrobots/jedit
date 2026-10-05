"""Docker-only public compiler witness; this does not execute a rope edit."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


GUARD = "  require canonicalHead == input.basisHeadId else text.BasisNotCanonical;\n"


def build(binary, workspace, document):
    request = {
        "schema": "edict.compiler.settings/v1",
        "type": "compilerSettings",
        "operation": "build",
        document: f"edict.{document}.json",
    }
    result = subprocess.run(
        [binary], cwd=workspace, input=json.dumps(request) + "\n",
        text=True, capture_output=True, timeout=120, check=False,
    )
    events = [
        json.loads(line)
        for stream in (result.stdout, result.stderr)
        for line in stream.splitlines()
    ]
    return result, events


def expect_refusal(binary, workspace, kind, detail):
    result, events = build(binary, workspace, "application")
    diagnostics = [event for event in events if event.get("type") == "diagnostic"]
    if result.returncode != 2 or len(diagnostics) != 1:
        raise RuntimeError(f"Unexpected build result: {result}\n{events}")
    diagnostic = diagnostics[0]
    if diagnostic["kind"] != kind or detail not in diagnostic["message"]:
        raise RuntimeError(f"Wrong failure boundary: {diagnostic}")
    output = workspace / ".build/application"
    if output.exists() and list(output.rglob("*")):
        raise RuntimeError("Refused application published output artifacts")
    print(json.dumps(diagnostic, sort_keys=True))


def main():
    if not Path("/.dockerenv").is_file():
        raise RuntimeError("Run this witness in its COPY-based Docker image")
    binary = os.environ.get("EDICT_BINARY", "/usr/local/bin/edict")
    provider = Path(os.environ.get("ECHO_PROVIDER_DIR", "/echo-provider"))
    source = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix="jedit-state-read-") as scratch:
        workspace = Path(scratch) / "application"
        workspace.mkdir()
        for document in ("edict.application.json", "edict.lawpack.json"):
            shutil.copyfile(source / document, workspace / document)
        shutil.copytree(source / "src", workspace / "src")
        shutil.copytree(provider, workspace / ".build/echo-provider")
        result, events = build(binary, workspace, "lawpack")
        if result.returncode != 0 or events[-1].get("status") != "ok":
            raise RuntimeError(f"Lawpack did not build: {result}\n{events}")
        authored = workspace / "src/ReplaceRange.edict"
        text = authored.read_text()
        manifest_digest = (workspace / "vendor/state-probe/manifest.sha256").read_text().strip()
        if f'digest "{manifest_digest}"' not in text or text.count(GUARD) != 1:
            raise RuntimeError("Source does not bind the exact generated lawpack and guard")
        expect_refusal(
            binary, workspace, "TargetLoweringFailed",
            "obstruction_requirement_step_output_dependency",
        )
        # This control removes only the dependent guard. The proposed read is
        # deliberately unsupported by the old provider; it must not execute.
        authored.write_text(text.replace(GUARD, ""))
        expect_refusal(
            binary, workspace, "ProviderLowererRefused", "UnsupportedSemantics",
        )
    print("JEDIT_STATE_READ_BOUNDARY_CONFIRMED")


if __name__ == "__main__":
    main()
