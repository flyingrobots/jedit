#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
set -eu
[ -f /.dockerenv ] || { echo 'Run in the COPY-based Docker image' >&2; exit 1; }
mkdir /comparison-output
for comparison in head payload; do
  case "$comparison" in
    head) source_file=ReplaceRange.edict ;;
    payload) source_file=PayloadEquality.edict ;;
  esac
  application="/comparison-$comparison"
  mkdir "$application"
  cp -R /application-source/. "$application/"
  cp "/comparison-sources/$source_file" "$application/src/ReplaceRange.edict"
  mkdir -p "$application/.build"
  cp -R /echo/schemas/edict-provider/package/v1 "$application/.build/echo-provider"
  cd "$application"
  printf '%s\n' '{"schema":"edict.compiler.settings/v1","type":"compilerSettings","operation":"build","application":"edict.application.json"}' | /edict/target/debug/edict
  cp -R .build/application "/comparison-output/$comparison"
done
printf '%s\n' 'JIM_BYTE_COMPARISON_PACKAGES_BUILT'
