#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
application_root="$project_root/edict/replace-range"
edict_repo=${EDICT_REPO:?set EDICT_REPO to an exact Edict checkout}
echo_repo=${ECHO_REPO:?set ECHO_REPO to an exact Echo checkout}
edict_bin=${EDICT_BIN:-"$edict_repo/target/debug/edict"}
provider_source="$echo_repo/schemas/edict-provider/package/v1"

test -x "$edict_bin"
test -f "$provider_source/provider-manifest.echo.json"
test -f "$provider_source/components/lowerer.echo-dpo.component.wasm"
test -f "$provider_source/components/verifier.echo-dpo.component.wasm"

if find "$provider_source" -type l -print -quit | grep -q .; then
  echo "provider package must not contain symlinks" >&2
  exit 1
fi

cd "$application_root"

printf '%s\n' \
  '{"schema":"edict.compiler.settings/v1","type":"compilerSettings","operation":"build","lawpack":"edict.lawpack.json"}' \
  | "$edict_bin"

rm -rf .build/echo-provider .build/application
mkdir -p .build/echo-provider
cp -RL "$provider_source/." .build/echo-provider/

if find .build/echo-provider -type l -print -quit | grep -q .; then
  echo "copied provider package must not contain symlinks" >&2
  exit 1
fi

set +e
build_output=$(
  printf '%s\n' \
    '{"schema":"edict.compiler.settings/v1","type":"compilerSettings","operation":"build","application":"edict.application.json"}' \
    | "$edict_bin" 2>&1
)
build_status=$?
set -e

printf '%s\n' "$build_output"
test "$build_status" -ne 0
printf '%s\n' "$build_output" \
  | jq --exit-status --slurp \
    'any(.[]; .type == "diagnostic" and .kind == "TargetLoweringFailed")' \
    >/dev/null
test ! -e .build/application/executable-operation-package.cbor
test ! -e .build/application/verification-report.cbor
