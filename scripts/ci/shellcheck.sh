#!/usr/bin/env bash
# ShellCheck every tracked shell script, plus the hook launchers that
# scripts/install-hooks.sh generates. The launchers exist only inside an
# installed hooks directory, so they are installed into a throwaway
# repository and checked there.
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

# shellcheck source=lib/shebang.sh
source "$root/scripts/ci/lib/shebang.sh"

scripts=()
unparsed=()
while IFS= read -r -d '' path; do
  case "$path" in
    *.sh) scripts+=("$path") ;;
    # Documentation is never opened by a check, even to read a shebang.
    *.md) ;;
    *)
      [[ -f "$path" ]] || continue
      status=0
      interpreter="$(shebang_interpreter "$path")" || status=$?
      if ((status == 2)); then
        unparsed+=("$path")
      elif ((status == 0)); then
        case "$interpreter" in
          bash | sh) scripts+=("$path") ;;
        esac
      fi
      ;;
  esac
done < <(git ls-files -z)

if ((${#unparsed[@]})); then
  printf 'shellcheck: cannot tell whether %s is a shell script from its env shebang\n' "${unparsed[@]}" >&2
  echo "shellcheck: use a plain shebang such as '#!/usr/bin/env bash' or '#!/bin/sh' (env options, quotes, and escapes are not parsed), or give a shell script a .sh extension." >&2
  exit 1
fi

if ((${#scripts[@]} == 0)); then
  echo "shellcheck: no tracked shell scripts found" >&2
  exit 1
fi
shellcheck -x "${scripts[@]}"

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
git -C "$scratch" init -q
mkdir -p "$scratch/scripts"
cp scripts/install-hooks.sh "$scratch/scripts/"
(cd "$scratch" && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 scripts/install-hooks.sh >/dev/null)
shellcheck "$scratch/.git/hooks/pre-commit" "$scratch/.git/hooks/pre-push"

echo "shellcheck: ${#scripts[@]} tracked scripts and 2 generated launchers are clean"
